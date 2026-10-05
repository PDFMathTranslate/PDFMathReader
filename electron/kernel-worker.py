"""App-owned adapters: capture upstream paragraph identity without editing packages."""

import inspect
import ast
import textwrap
import json
import os
import re
import sys
from time import perf_counter

STARTED = perf_counter()
from pathlib import Path
import pymupdf


def fast_paragraph_indent(text, x, x0, language):
    """Replace inherited source indentation with two CJK full-width spaces."""
    if language.lower().split("-")[0] in ("zh", "ja", "ko") and x > x0 + 0.1:
        return "\u3000\u3000" + text.lstrip(" \t\u3000"), x0
    return text, x


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


def main(capture_only=False):
    if capture_only:
        kind, sidecar, selected, input_path, args = json.loads(
            os.environ["PREVIEW_CAPTURE_CONTEXT"]
        )
    else:
        kind, sidecar, selected, input_path, *args = sys.argv[1:]
    selected = int(selected)
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
                return original_stream(*positional, **kwargs)
            finally:
                high_level.Document = original_document

        high_level.translate_stream = timed_stream
        step("imports")
        original = TranslateConverter.receive_layout

        def capture(v):
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
                        "translatedWidth": "source-paragraph-width",
                    }
                )

        # Inject one capture per paragraph, instead of tracing every Python line
        # during parsing, provider calls and typesetting. Upstream files stay intact.
        tree = ast.parse(textwrap.dedent(inspect.getsource(original)))

        class CaptureParagraph(ast.NodeTransformer):
            count = 0
            indent_count = 0

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
        if injector.count != 1 or injector.indent_count != 1:
            raise RuntimeError("Fast paragraph capture is incompatible with this kernel version")
        namespace = {
            **original.__globals__,
            "_preview_capture": capture,
            "_preview_indent": fast_paragraph_indent,
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
                        if para.box and (para.unicode or "").strip():
                            pending.append(
                                (
                                    para,
                                    {
                                        "id": f"precise-{selected}-{para.debug_id or len(pending)}",
                                        "page": selected,
                                        "text": para.unicode,
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
