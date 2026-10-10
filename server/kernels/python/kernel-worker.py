"""App-owned adapters: capture upstream paragraph identity without editing packages."""

import inspect
import ast
import textwrap
import json
import math
import os
import re
import sys
import threading
from time import perf_counter

# Set before native imports, including multiprocessing capture workers.
os.environ["ORT_DISABLE_TELEMETRY"] = "1"

STARTED = perf_counter()
from pathlib import Path
import pymupdf

PROGRESS_PREFIX = "PDFMATH_PROGRESS:"
MAX_PROGRESS_STAGE_LENGTH = 160
_progress_output_broken = False


def emit_kernel_progress(stage, completed, total, percent):
    """Write one bounded progress record without affecting translation."""
    global _progress_output_broken
    if _progress_output_broken or not isinstance(stage, str):
        return
    stage = re.sub(r"[\r\n]+", " ", stage).strip()[:MAX_PROGRESS_STAGE_LENGTH]
    if not stage:
        return
    values = (completed, total) if percent is None else (completed, total, percent)
    if any(isinstance(value, bool) or not isinstance(value, (int, float)) for value in values):
        return
    if any(not math.isfinite(float(value)) for value in values):
        return
    if (
        total <= 0
        or completed < 0
        or completed > total
        or (percent is not None and (percent < 0 or percent > 100))
    ):
        return
    payload = {
        "stage": stage,
        "completed": completed,
        "total": total,
        "percent": percent,
    }
    try:
        print(
            PROGRESS_PREFIX + json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            flush=True,
        )
    except (BrokenPipeError, OSError):
        # A closed parent stdout must not change the translation result.
        _progress_output_broken = True


def emit_fast_progress(progress):
    """Forward Fast's stage-local tqdm callback state."""
    completed = getattr(progress, "n", None)
    total = getattr(progress, "total", None)
    if not isinstance(completed, (int, float)) or not isinstance(total, (int, float)):
        return
    if total <= 0:
        return
    stage = getattr(progress, "desc", None) or "Translate pages"
    if stage == "Translate pages":
        emit_kernel_progress("Analyze page", completed, total, None)
    else:
        emit_kernel_progress(stage, completed, total, completed * 100 / total)


def fast_progress_map(executor, worker, paragraphs):
    """Count completed native paragraph tasks, including ordinary Fast mode."""
    paragraphs = list(paragraphs)
    total = len(paragraphs)
    if not total:
        return executor.map(worker, paragraphs)
    completed = 0
    lock = threading.Lock()
    emit_kernel_progress("Translate paragraphs", 0, total, 0)

    def counted(paragraph):
        nonlocal completed
        result = worker(paragraph)
        with lock:
            completed += 1
            emit_kernel_progress("Translate paragraphs", completed, total, completed * 100 / total)
        return result

    return executor.map(counted, paragraphs)


def emit_precise_progress(event):
    """Forward BabelDOC's native overall progress and stage counters."""
    if not isinstance(event, dict):
        return
    emit_kernel_progress(
        event.get("stage"),
        event.get("stage_current"),
        event.get("stage_total"),
        event.get("overall_progress"),
    )


def fast_paragraph_indent(text, x, x0, language):
    """Replace inherited source indentation with two CJK full-width spaces."""
    # Protected tables and formulas are emitted as one placeholder run. Their
    # first glyph is not a prose indent: moving it moves every retained glyph
    # and rule in the run, which can push the whole table beyond the page edge.
    if not re.sub(r"\{+\s*v\d+\s*\}+", "", text).strip():
        return text, x
    if language.lower().split("-")[0] in ("zh", "ja", "ko") and x > x0 + 0.1:
        return "\u3000\u3000" + text.lstrip(" \t\u3000"), x0
    return text, x


def fast_typography_advance(converter, text, ptr, advance, size, language):
    """Reserve trailing CJK punctuation together with the preceding character."""
    if language.lower().split("-")[0] != "zh":
        return advance
    end = ptr
    while end < len(text) and text[end] in "，。！？；：、）】》”’":
        end += 1
    if end > ptr:
        advance += sum(converter.noto.char_lengths(text[ptr:end], size))
    return advance


def fast_italic_prose_characters(page):
    """Recognize ordinary italic prose without relaxing math-font detection."""
    protected = set()
    run = []

    def finish():
        text = "".join(char.get_text() for char in run)
        words = re.findall(r"[A-Za-z]+", text)
        if (
            re.fullmatch(r"[A-Za-z\s.,:'’()\-]+", text)
            and words
            and max(map(len, words)) >= 4
            and (len(words) >= 2 or max(map(len, words)) >= 5)
        ):
            protected.update(id(char) for char in run)
        run.clear()

    for char in page:
        font = getattr(char, "fontname", "")
        if isinstance(font, bytes):
            font = font.decode("utf-8", errors="ignore")
        font = font.split("+")[-1]
        # CM/TeX, symbol, code and explicitly configured formula fonts stay intact.
        if not re.match(
            r"(?:Times|Helvetica|Arial|Georgia|Palatino|Minion|Garamond|Liberation|Nimbus).*"
            r"(?:Italic|Oblique)",
            font,
            re.IGNORECASE,
        ):
            finish()
            continue
        if run and (
            char.fontname != run[-1].fontname
            or abs(char.y0 - run[-1].y0) > max(1, char.size * 0.2)
            or char.x0 - run[-1].x1 > char.size
            or char.x0 < run[-1].x0
        ):
            finish()
        run.append(char)
    finish()
    return protected


def fast_resolve_text_overlaps(context):
    """Try moving translated lines below retained runs, inside the paragraph box."""
    from pdfminer.pdffont import PDFCIDFont

    converter = context["self"]
    paragraph = context["pstk"][context["id"]]
    size, leading = context["size"], context["line_height"]
    step = size * leading
    translated_fonts = {"tiro", converter.noto_name}
    items = [item for item in context["ops_vals"] if item.get("type").value == "text"]

    def bounds(item):
        font = item["font"]
        encoded = item["rtxt"]
        if font == converter.noto_name:
            width = len(encoded) / 4 * item["size"]
        else:
            pdf_font = converter.fontmap[font]
            stride = 4 if isinstance(pdf_font, PDFCIDFont) else 2
            width = (
                sum(
                    pdf_font.char_width(int(encoded[i : i + stride], 16))
                    for i in range(0, len(encoded), stride)
                )
                * item["size"]
            )
        baseline = context["y"] + item["dy"] - item["lidx"] * step
        return (
            item["x"],
            baseline - item["size"] * 0.2,
            item["x"] + width,
            baseline + item["size"] * 0.8,
        )

    retained = [bounds(item) for item in items if item["font"] not in translated_fonts]
    moved = 0
    for line in sorted({item["lidx"] for item in items if item["font"] in translated_fonts}):
        current = [
            item for item in items if item["font"] in translated_fonts and item["lidx"] == line
        ]
        for _ in range(3):
            collision = any(
                min(a[2], b[2]) - max(a[0], b[0]) > size * 0.15
                and min(a[3], b[3]) - max(a[1], b[1]) > size * 0.15
                for a in map(bounds, current)
                for b in retained
            )
            if not collision:
                break
            following = [
                item for item in items if item["font"] in translated_fonts and item["lidx"] >= line
            ]
            if min(bounds(item)[1] for item in following) - step < paragraph.y0:
                break
            for item in following:
                item["dy"] -= step
            moved += 1
    return moved


def layout_box(values, source_page, kind):
    # Fast's interpreter applies its CropBox/rotation CTM before layout.
    # Its coordinates are already in the visible page's bottom-left frame.
    # Applying the raw PDF transform again subtracts the CropBox twice.
    if kind == "pdf_math_fast":
        matrix = pymupdf.Matrix(1, 0, 0, -1, 0, source_page.rect.height)
    else:
        matrix = source_page.transformation_matrix * source_page.rotation_matrix
    rect = pymupdf.Rect(*values) * matrix
    return {"x": rect.x0, "y": rect.y0, "width": max(1, rect.width), "height": max(1, rect.height)}


def install_glossary(kind, entries):
    """Enforce terms at the translator boundary for every service."""
    if not entries:
        return
    if kind == "pdf_math_fast":
        from pdf2zh.translator import BaseTranslator
    else:
        from pdf2zh_next.translator.base_translator import BaseTranslator
    targets = {entry["source"]: entry["target"] for entry in entries}
    pattern = re.compile(
        "|".join(re.escape(source) for source in sorted(targets, key=len, reverse=True))
    )

    def wrap(original, structured=False):
        def translate(self, text, *args, **kwargs):
            prefix = "PMRGLOSSARY"
            while prefix in text:
                prefix += "X"
            replacements = []

            def protect(match):
                token = f"{prefix}{len(replacements)}END"
                replacements.append((token, targets[match.group()]))
                return token

            protected = pattern.sub(protect, text)
            if replacements:
                if args:
                    args = (True, *args[1:])
                else:
                    kwargs["ignore_cache"] = True
            output = original(self, protected, *args, **kwargs)
            for token, target in replacements:
                if token not in output:
                    raise ValueError(
                        "Translation did not preserve a required glossary term. Retry translation."
                    )
                # LLM-only output is JSON; escape inserted values to keep it valid.
                replacement = json.dumps(target, ensure_ascii=False)[1:-1] if structured else target
                output = output.replace(token, replacement)
            return output

        return translate

    def patch_overrides(cls):
        for child in cls.__subclasses__():
            if "translate" in child.__dict__:
                child.translate = wrap(child.translate)
            if "llm_translate" in child.__dict__:
                child.llm_translate = wrap(child.llm_translate, structured=True)
            patch_overrides(child)

    patch_overrides(BaseTranslator)
    BaseTranslator.translate = wrap(BaseTranslator.translate)
    if hasattr(BaseTranslator, "llm_translate"):
        BaseTranslator.llm_translate = wrap(BaseTranslator.llm_translate, structured=True)


def configure_gpu_inference():
    import onnxruntime as ort

    available = ort.get_available_providers()
    preferred = [
        name
        for name in ("DmlExecutionProvider", "CoreMLExecutionProvider", "CUDAExecutionProvider")
        if name in available
    ]
    providers = [*preferred, "CPUExecutionProvider"]
    original = ort.InferenceSession.__init__

    def initialize(
        self, path_or_bytes, sess_options=None, providers=None, provider_options=None, **kwargs
    ):
        selected = [*preferred, "CPUExecutionProvider"]
        if sess_options is None:
            sess_options = ort.SessionOptions()
        if "DmlExecutionProvider" in selected:
            sess_options.enable_mem_pattern = False
            sess_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        # CoreML compiled nodes cannot be serialized as an optimized ONNX graph.
        if "CoreMLExecutionProvider" in selected:
            sess_options.optimized_model_filepath = ""
        return original(self, path_or_bytes, sess_options, selected, None, **kwargs)

    ort.InferenceSession.__init__ = initialize
    print("GPU inference providers: " + ", ".join(providers), file=sys.stderr)


def main(capture_only=False):
    if capture_only:
        kind, sidecar, selected, input_path, args = json.loads(
            os.environ["PREVIEW_CAPTURE_CONTEXT"]
        )
    else:
        kind, sidecar, selected, input_path, *args = sys.argv[1:]
    if "--prefer-gpu" in args:
        os.environ["PDFMATHREADER_PREFER_GPU"] = "1"
        args = [arg for arg in args if arg != "--prefer-gpu"]
    if os.environ.get("PDFMATHREADER_PREFER_GPU") == "1":
        configure_gpu_inference()
    selected = int(selected)
    glossary_path = os.environ.get("PDFMATHREADER_GLOSSARY_PATH")
    if glossary_path:
        install_glossary(kind, json.loads(Path(glossary_path).read_text(encoding="utf-8")))
    if os.environ.get("PDFMATHREADER_LOCAL_TRANSLATION") == "1":
        # The native API receives source text, never an LLM instruction template.
        import urllib.request

        def local_translate(self, text, *unused, **options):
            request = urllib.request.Request(
                os.environ["OPENAI_BASE_URL"] + "/translate",
                data=json.dumps({"text": text}).encode(),
                headers={
                    "Authorization": "Bearer " + os.environ["OPENAI_API_KEY"],
                    "Content-Type": "application/json",
                },
            )
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)["translation"]

        if kind == "pdf_math_fast":
            from pdf2zh.translator import OpenAITranslator
        else:
            from pdf2zh_next.translator.translator_impl.openai import OpenAITranslator

            def no_llm(self, *args, **kwargs):
                raise NotImplementedError("Apple Translation is a text translation API")

            OpenAITranslator.do_llm_translate = no_llm
        OpenAITranslator.do_translate = local_translate
    timings = {}
    checkpoint = perf_counter()

    def step(name):
        nonlocal checkpoint
        now = perf_counter()
        timings[name] = timings.get(name, 0) + (now - checkpoint) * 1000
        checkpoint = now

    source_pdf = pymupdf.open(input_path)
    source_page = source_pdf[selected - 1]
    records = []

    def box(values):
        return layout_box(values, source_page, kind)

    if kind == "pdf_math_fast":
        from pdf2zh.converter import TranslateConverter

        output_language = next(
            (args[i + 1] for i, arg in enumerate(args[:-1]) if arg in ("-lo", "--lang-out")), ""
        )
        import pdf2zh.high_level as high_level

        original_stream = high_level.translate_stream
        original_document = high_level.Document
        stream_lines, stream_start = inspect.getsourcelines(original_stream)
        stream_tree = ast.parse(textwrap.dedent("".join(stream_lines)))
        source_document_lines = {
            stream_start + node.lineno - 1
            for node in ast.walk(stream_tree)
            if isinstance(node, ast.Assign)
            and any(
                isinstance(target, ast.Name) and target.id == "doc_en" for target in node.targets
            )
            and isinstance(node.value, ast.Call)
            and isinstance(node.value.func, ast.Name)
            and node.value.func.id == "Document"
        }

        class Timer:
            def add(self, name, seconds):
                timings[name] = timings.get(name, 0) + seconds * 1000

            def step(self, name):
                step(name)

        def timed_stream(*positional, **kwargs):
            step("model_and_cli_setup")
            kwargs["perf"] = Timer()
            callback = kwargs.get("callback")

            def progress_callback(progress):
                emit_fast_progress(progress)
                if callback:
                    callback(progress)

            # pdf2zh.high_level.translate_patch invokes this callback after
            # each native page, paragraph, or typesetting update. Keep the
            # caller's callback and add the app-owned stdout record beside it.
            kwargs["callback"] = progress_callback

            def mono_document(*args, **options):
                doc = original_document(*args, **options)
                caller = sys._getframe(1)
                if (
                    caller.f_code is original_stream.__code__
                    and caller.f_lineno in source_document_lines
                ):
                    # doc_en is only used for the unused bilingual output after
                    # its working copy is saved. Keep source save/font behavior;
                    # avoid a second font subset and duplicate PDF serialization.
                    doc.insert_file = lambda *a, **k: None
                    doc.move_page = lambda *a, **k: None
                    doc.subset_fonts = lambda *a, **k: None
                    doc.write = lambda *a, **k: b""
                return doc

            high_level.Document = mono_document
            try:
                result = original_stream(*positional, **kwargs)
                emit_kernel_progress("Finalize PDF", 0, 1, None)
                return result
            finally:
                high_level.Document = original_document

        high_level.translate_stream = timed_stream
        # Retain the layout detector's explicit formula boxes. Protected table
        # placeholders must not be mistaken for formula paragraphs.
        from pdf2zh.doclayout import OnnxModel

        original_predict = OnnxModel.predict

        def formula_predict(model, image, *args, **kwargs):
            results = original_predict(model, image, *args, **kwargs)
            for result in results:
                for detected in result.boxes:
                    label = result.names[int(detected.cls)]
                    if label not in ("isolate_formula", "formula", "equation"):
                        continue
                    x0, y0, x1, y1 = map(float, detected.xyxy.squeeze())
                    sx = source_page.rect.width / image.shape[1]
                    sy = source_page.rect.height / image.shape[0]
                    region = {
                        "x": max(0, x0 * sx),
                        "y": max(0, y0 * sy),
                        "width": (min(source_page.rect.width, x1 * sx) - max(0, x0 * sx)),
                        "height": (min(source_page.rect.height, y1 * sy) - max(0, y0 * sy)),
                    }
                    if region["width"] <= 0 or region["height"] <= 0:
                        continue
                    records.append(
                        {
                            "id": f"fast-formula-{selected}-{len(records)}",
                            "page": selected,
                            "text": "",
                            "translation": "",
                            "sourceBox": region,
                            "translatedBox": dict(region),
                            "fontSize": 12,
                            "isFormula": True,
                            "layoutLabel": label,
                            "layoutSource": "pdf2zh.doclayout",
                        }
                    )
            return results

        OnnxModel.predict = formula_predict
        step("imports")

        # OCR pages bypass TranslateConverter.receive_layout entirely. Reuse
        # upstream's paragraph reconstruction and typesetting, while tagging
        # each translated string so the reader receives the same sidecar
        # records as native-text pages.
        import pdf2zh.ocr as ocr_module

        original_ocr_paragraphs = ocr_module.ocr_paragraphs
        original_translate_ocr_page = ocr_module.translate_ocr_page

        def capture_ocr_page(page, detection, translator, font, thread, cancellation_event=None):
            paragraphs = original_ocr_paragraphs(page, detection)
            if not paragraphs:
                return original_translate_ocr_page(
                    page, detection, translator, font, thread, cancellation_event
                )

            translations = [None] * len(paragraphs)

            class TaggedText(str):
                def __new__(cls, value, index):
                    result = super().__new__(cls, value)
                    result.index = index
                    return result

            tagged = [
                (bounds, TaggedText(text, index), size, words)
                for index, (bounds, text, size, words) in enumerate(paragraphs)
            ]

            class CapturingTranslator:
                def __init__(self, delegate):
                    self.delegate = delegate

                def translate(self, text, *args, **kwargs):
                    output = self.delegate.translate(str(text), *args, **kwargs)
                    translations[text.index] = output
                    return output

            # translate_ocr_page resolves ocr_paragraphs from its module
            # globals. Return the captured list so OCR is reconstructed once.
            ocr_module.ocr_paragraphs = lambda *_args, **_kwargs: tagged
            try:
                result = original_translate_ocr_page(
                    page,
                    detection,
                    CapturingTranslator(translator),
                    font,
                    thread,
                    cancellation_event,
                )
            finally:
                ocr_module.ocr_paragraphs = original_ocr_paragraphs

            for index, (bounds, text, size, _words) in enumerate(paragraphs):
                text = str(text)
                if not text.strip():
                    continue
                region = {
                    "x": float(bounds.x0),
                    "y": float(bounds.y0),
                    "width": max(1, float(bounds.width)),
                    "height": max(1, float(bounds.height)),
                }
                translation = str(translations[index] or "")
                records.append(
                    {
                        "id": f"fast-ocr-{selected}-{len(records)}",
                        "page": selected,
                        "text": text,
                        "translation": translation,
                        "sourceBox": region,
                        "translatedBox": dict(region),
                        "fontSize": float(size or 12),
                        "sourceInput": text,
                        "translationOutput": translation,
                        "layoutSource": "pdf2zh.ocr",
                        "translatedWidth": "source-paragraph-width",
                    }
                )
            return result

        ocr_module.translate_ocr_page = capture_ocr_page
        original = TranslateConverter.receive_layout

        def capture(v):
            overlap_adjustments = fast_resolve_text_overlaps(v)
            index = v["id"]
            paragraph = v["pstk"][index]
            raw_source, raw_target = v["sstk"][index], v["news"][index]
            variables = ["".join(c.get_text() for c in chars) for chars in v["var"]]

            def restore(text):
                return re.sub(
                    r"\{+\s*v(\d+)\s*\}+",
                    lambda m: variables[int(m[1])] if int(m[1]) < len(variables) else m[0],
                    text,
                )

            display_target, _ = fast_paragraph_indent(
                raw_target, paragraph.x, paragraph.x0, output_language
            )
            text, translation = restore(raw_source), restore(display_target)
            # {v*} is prompt notation, not an upstream formula ID. Recover only
            # when the source paragraph identifies exactly one original run.
            source_ids = set(int(m) for m in re.findall(r"\{+\s*v(\d+)\s*\}+", raw_source))
            wildcard = re.compile(r"\{+\s*v\s*\*\s*\}+", re.IGNORECASE)
            if wildcard.search(translation):
                if len(source_ids) == 1 and next(iter(source_ids)) < len(variables):
                    replacement = variables[next(iter(source_ids))]
                    translation = wildcard.sub(lambda _: replacement, translation)
                else:
                    translation = text
            if text.strip():
                values = [item for item in v["ops_vals"] if item.get("type").value == "text"]
                low = min(
                    (
                        item["dy"]
                        + v["y"]
                        - item["lidx"] * item["size"] * v["line_height"]
                        - item["size"] * 0.25
                        for item in values
                    ),
                    default=paragraph.y0,
                )
                high = max(
                    (
                        item["dy"]
                        + v["y"]
                        - item["lidx"] * item["size"] * v["line_height"]
                        + item["size"]
                        for item in values
                    ),
                    default=paragraph.y1,
                )
                records.append(
                    {
                        "id": f"fast-{selected}-{len(records)}",
                        "page": selected,
                        "text": text,
                        "translation": translation,
                        "sourceBox": box((paragraph.x0, paragraph.y0, paragraph.x1, paragraph.y1)),
                        "translatedBox": box((paragraph.x0, low, paragraph.x1, high)),
                        "fontSize": paragraph.size,
                        "sourceInput": raw_source,
                        "translationOutput": raw_target,
                        "formulaTexts": variables,
                        "layoutSource": "pdf2zh.converter",
                        "overlapAdjustments": overlap_adjustments,
                        "translatedWidth": "source-paragraph-width",
                    }
                )

        # Inject one capture per paragraph, instead of tracing every Python line
        # during parsing, provider calls and typesetting. Upstream files stay intact.
        tree = ast.parse(textwrap.dedent(inspect.getsource(original)))

        class CaptureParagraph(ast.NodeTransformer):
            count = 0
            indent_count = 0
            prose_count = 0

            def visit_FunctionDef(self, node):
                self.generic_visit(node)
                if node.name == "receive_layout":
                    node.body.insert(
                        0,
                        ast.parse(
                            "_preview_prose = set() if self.vfont else _preview_italic_prose(ltpage)"
                        ).body[0],
                    )
                return node

            def visit_Call(self, node):
                self.generic_visit(node)
                if (
                    isinstance(node.func, ast.Attribute)
                    and isinstance(node.func.value, ast.Name)
                    and node.func.value.id == "executor"
                    and node.func.attr == "map"
                    and len(node.args) == 2
                    and isinstance(node.args[0], ast.Name)
                    and node.args[0].id == "worker"
                ):
                    return ast.Call(
                        func=ast.Name(id="_preview_progress_map", ctx=ast.Load()),
                        args=[node.func.value, *node.args],
                        keywords=node.keywords,
                    )
                if isinstance(node.func, ast.Name) and node.func.id == "vflag":
                    self.prose_count += 1
                    return ast.IfExp(
                        test=ast.parse("_preview_identity(child) in _preview_prose").body[0].value,
                        body=ast.Constant(value=False),
                        orelse=node,
                    )
                return node

            def visit_Compare(self, node):
                self.generic_visit(node)
                # Only the converter's two right-edge checks; glyph advance stays real.
                if (
                    isinstance(node.left, ast.BinOp)
                    and isinstance(node.left.op, ast.Add)
                    and isinstance(node.left.left, ast.Name)
                    and node.left.left.id == "x"
                    and isinstance(node.left.right, ast.Name)
                    and node.left.right.id == "adv"
                    and any(isinstance(op, ast.Gt) for op in node.ops)
                ):
                    node.left.right = (
                        ast.parse(
                            "_preview_wrap_advance(self, new, ptr, adv, size, _preview_language)"
                        )
                        .body[0]
                        .value
                    )
                return node

            def visit_Assign(self, node):
                self.generic_visit(node)
                # Use identical metrics for the emitted Latin glyphs and line wrapping.
                if (
                    len(node.targets) == 1
                    and isinstance(node.targets[0], ast.Name)
                    and node.targets[0].id == "adv"
                    and isinstance(node.value, ast.BinOp)
                    and isinstance(node.value.op, ast.Mult)
                    and isinstance(node.value.right, ast.Name)
                    and node.value.right.id == "size"
                ):
                    node.value = ast.BinOp(
                        left=node.value,
                        op=ast.Mult(),
                        right=ast.parse(
                            "1.08 if _preview_language.lower().split('-')[0] == 'zh' else 1.0"
                        )
                        .body[0]
                        .value,
                    )
                return node

            def visit_Dict(self, node):
                self.generic_visit(node)
                # Preserve source formula sizes; only ordinary translated Latin runs.
                values = {
                    key.value: value
                    for key, value in zip(node.keys, node.values)
                    if isinstance(key, ast.Constant)
                }
                if (
                    isinstance(values.get("font"), ast.Name)
                    and values["font"].id == "fcur"
                    and isinstance(values.get("size"), ast.Name)
                    and values["size"].id == "size"
                ):
                    for i, key in enumerate(node.keys):
                        if isinstance(key, ast.Constant) and key.value == "size":
                            node.values[i] = (
                                ast.parse(
                                    "size * (1.08 if fcur == 'tiro' and _preview_language.lower().split('-')[0] == 'zh' else 1.0)"
                                )
                                .body[0]
                                .value
                            )
                return node

            def visit_AnnAssign(self, node):
                if isinstance(node.target, ast.Name) and node.target.id == "cstk":
                    self.indent_count += 1
                    return [
                        *ast.parse("new, x = _preview_indent(new, x, x0, _preview_language)").body,
                        node,
                    ]
                return node

            def visit_For(self, node):
                self.generic_visit(node)
                if (
                    isinstance(node.target, ast.Name)
                    and node.target.id == "vals"
                    and isinstance(node.iter, ast.Name)
                    and node.iter.id == "ops_vals"
                ):
                    self.count += 1
                    return [
                        ast.Expr(
                            value=ast.Call(
                                func=ast.Name(id="_preview_capture", ctx=ast.Load()),
                                args=[
                                    ast.Call(
                                        func=ast.Name(id="locals", ctx=ast.Load()),
                                        args=[],
                                        keywords=[],
                                    )
                                ],
                                keywords=[],
                            )
                        ),
                        node,
                    ]
                return node

        injector = CaptureParagraph()
        tree = injector.visit(tree)
        if injector.count != 1 or injector.indent_count != 1 or injector.prose_count != 1:
            raise RuntimeError("Fast paragraph capture is incompatible with this kernel version")
        namespace = {
            **original.__globals__,
            "_preview_capture": capture,
            "_preview_progress_map": fast_progress_map,
            "_preview_indent": fast_paragraph_indent,
            "_preview_wrap_advance": fast_typography_advance,
            "_preview_italic_prose": fast_italic_prose_characters,
            "_preview_identity": id,
            "_preview_language": output_language,
        }
        exec(
            compile(ast.fix_missing_locations(tree), inspect.getsourcefile(original), "exec"),
            namespace,
        )
        TranslateConverter.receive_layout = namespace[original.__name__]
        # The reader consumes one page. Preserve its MediaBox, CropBox, rotation,
        # resources and annotations while preventing whole-document font work.
        page_pdf = pymupdf.open()
        page_pdf.insert_pdf(source_pdf, from_page=selected - 1, to_page=selected - 1)
        page_input = str(Path(input_path).with_name("selected.pdf"))
        page_pdf.save(page_input)
        page_pdf.close()
        args = [page_input if arg == input_path else arg for arg in args]
        page_flag = next(i for i, arg in enumerate(args) if arg in ("-p", "--pages"))
        args[page_flag + 1] = "1"
        step("select_page")
        from pdf2zh.pdf2zh import main

        status = main(args)
        step("output_write")
        timings["workerTotal"] = (perf_counter() - STARTED) * 1000
        Path(sidecar + ".timing.json").write_text(json.dumps(timings), encoding="utf-8")
    else:
        from babeldoc.format.pdf.document_il.midend.il_translator import ILTranslator
        from babeldoc.format.pdf.document_il.midend.il_translator_llm_only import (
            ILTranslatorLLMOnly,
        )
        from babeldoc.format.pdf.document_il.midend.typesetting import Typesetting

        pending = []

        def values(rect):
            return (rect.x, rect.y, rect.x2, rect.y2)

        def content(obj):
            if obj is None:
                return ""
            for name in ("pdf_line", "pdf_formula", "pdf_same_style_characters"):
                value = getattr(obj, name, None)
                if value is not None:
                    return "".join(content(c) for c in getattr(value, "pdf_character", []))
            for name in ("pdf_character", "pdf_same_style_unicode_characters"):
                value = getattr(obj, name, None)
                if value is not None:
                    return getattr(value, "unicode", "") or ""
            return getattr(obj, "unicode", "") or ""

        def wrap_translate(original):
            def translate(self, docs):
                for page in docs.page:
                    for para in page.pdf_paragraph:
                        if para.box and (
                            (para.unicode or "").strip()
                            or str(para.layout_label or "").lower()
                            in ("formula", "isolate_formula", "equation")
                        ):
                            pending.append(
                                (
                                    para,
                                    {
                                        "id": f"precise-{selected}-{para.debug_id or len(pending)}",
                                        "page": selected,
                                        "text": para.unicode or "",
                                        "sourceBox": box(values(para.box)),
                                        "fontSize": getattr(para.pdf_style, "font_size", None)
                                        or 12,
                                        "layoutLabel": para.layout_label,
                                        "layoutSource": "babeldoc.document_il",
                                        "nativePageNumber": page.page_number,
                                    },
                                )
                            )
                return original(self, docs)

            return translate

        ILTranslator.translate = wrap_translate(ILTranslator.translate)
        ILTranslatorLLMOnly.translate = wrap_translate(ILTranslatorLLMOnly.translate)
        original_typeset = Typesetting.typesetting_document

        def typeset(self, docs):
            result = original_typeset(self, docs)
            for para, record in pending:
                record["translationOutput"] = para.unicode
                record["translation"] = (
                    "".join(content(c) for c in para.pdf_paragraph_composition)
                    or para.unicode
                    or record["text"]
                )
                record["translatedBox"] = box(values(para.box))
                records.append(record)
            pending.clear()
            Path(sidecar).write_text(
                json.dumps(
                    {
                        "schema": 1,
                        "engine": kind,
                        "page": selected,
                        "width": source_page.rect.width,
                        "height": source_page.rect.height,
                        "paragraphs": records,
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            return result

        Typesetting.typesetting_document = typeset
        if capture_only:
            return
        import pdf2zh_next.high_level as precise_high_level

        original_precise_stream = precise_high_level.do_translate_async_stream

        async def progress_stream(*positional, **kwargs):
            async for event in original_precise_stream(*positional, **kwargs):
                emit_precise_progress(event)
                yield event

        # do_translate_file_async resolves do_translate_async_stream through
        # the high_level module, so this wraps both its CLI and native paths.
        precise_high_level.do_translate_async_stream = progress_stream
        os.environ["PREVIEW_CAPTURE_CONTEXT"] = json.dumps(
            [kind, sidecar, selected, input_path, args]
        )
        from pdf2zh_next.main import cli

        sys.argv = ["pdf2zh", *args]
        try:
            status = cli()
        except SystemExit as exit:
            status = exit.code

    if status not in (None, 0):
        sys.exit(status)
    if records or not Path(sidecar).exists():
        Path(sidecar).write_text(
            json.dumps(
                {
                    "schema": 1,
                    "engine": kind,
                    "page": selected,
                    "width": source_page.rect.width,
                    "height": source_page.rect.height,
                    "paragraphs": records,
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
    source_pdf.close()


if __name__ == "__main__":
    main()

elif __name__ == "__mp_main__" and "PREVIEW_CAPTURE_CONTEXT" in os.environ:
    main(capture_only=True)
