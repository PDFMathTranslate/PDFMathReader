"""App-owned adapters: capture upstream paragraph identity without editing packages."""
import inspect
import json
import os
import re
import sys
from pathlib import Path
import pymupdf

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
        kind, sidecar, selected, input_path, args = json.loads(os.environ["PREVIEW_CAPTURE_CONTEXT"])
    else:
        kind, sidecar, selected, input_path, *args = sys.argv[1:]
    selected = int(selected)
    source_pdf = pymupdf.open(input_path)
    source_page = source_pdf[selected - 1]
    records = []
    
    def box(values):
        return layout_box(values, source_page, kind)
    
    if kind == "pdf_math_fast":
        from pdf2zh.converter import TranslateConverter
        original = TranslateConverter.receive_layout
        lines, start = inspect.getsourcelines(original)
        capture_line = next(start + i for i, line in enumerate(lines) if "for vals in ops_vals:" in line)
        def receive(self, page):
            previous = sys.gettrace()
            seen = set()
            def trace(frame, event, arg):
                if frame.f_code is original.__code__ and event == "line" and frame.f_lineno == capture_line and frame.f_locals["id"] not in seen:
                    v = frame.f_locals
                    index = v["id"]
                    seen.add(index)
                    paragraph = v["pstk"][index]
                    raw_source, raw_target = v["sstk"][index], v["news"][index]
                    variables = ["".join(c.get_text() for c in chars) for chars in v["var"]]
                    def restore(text):
                        return re.sub(r"\{+\s*v(\d+)\s*\}+", lambda m: variables[int(m[1])] if int(m[1]) < len(variables) else m[0], text)
                    text, translation = restore(raw_source), restore(raw_target)
                    if text.strip():
                        values = [item for item in v["ops_vals"] if item.get("type").value == "text"]
                        low = min((item["dy"] + v["y"] - item["lidx"] * item["size"] * v["line_height"] - item["size"] * .25 for item in values), default=paragraph.y0)
                        high = max((item["dy"] + v["y"] - item["lidx"] * item["size"] * v["line_height"] + item["size"] for item in values), default=paragraph.y1)
                        records.append({"id": f"fast-{selected}-{len(records)}", "page": selected, "text": text, "translation": translation, "sourceBox": box((paragraph.x0, paragraph.y0, paragraph.x1, paragraph.y1)), "translatedBox": box((paragraph.x0, low, paragraph.x1, high)), "fontSize": paragraph.size, "sourceInput": raw_source, "translationOutput": raw_target, "formulaTexts": variables, "layoutSource": "pdf2zh.converter", "translatedWidth": "source-paragraph-width"})
                return trace if frame.f_code is original.__code__ else None
            sys.settrace(trace)
            try:
                return original(self, page)
            finally:
                sys.settrace(previous)
        TranslateConverter.receive_layout = receive
        from pdf2zh.pdf2zh import main
        status = main(args)
    else:
        from babeldoc.format.pdf.document_il.midend.il_translator import ILTranslator
        from babeldoc.format.pdf.document_il.midend.il_translator_llm_only import ILTranslatorLLMOnly
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
                            pending.append((para, {"id": f"precise-{selected}-{para.debug_id or len(pending)}", "page": selected, "text": para.unicode, "sourceBox": box(values(para.box)), "fontSize": getattr(para.pdf_style, "font_size", None) or 12, "layoutLabel": para.layout_label, "layoutSource": "babeldoc.document_il", "nativePageNumber": page.page_number}))
                return original(self, docs)
            return translate
        ILTranslator.translate = wrap_translate(ILTranslator.translate)
        ILTranslatorLLMOnly.translate = wrap_translate(ILTranslatorLLMOnly.translate)
        original_typeset = Typesetting.typesetting_document
        def typeset(self, docs):
            result = original_typeset(self, docs)
            for para, record in pending:
                record["translationOutput"] = para.unicode
                record["translation"] = "".join(content(c) for c in para.pdf_paragraph_composition) or para.unicode or record["text"]
                record["translatedBox"] = box(values(para.box))
                records.append(record)
            pending.clear()
            Path(sidecar).write_text(json.dumps({"schema": 1, "engine": kind, "page": selected, "width": source_page.rect.width, "height": source_page.rect.height, "paragraphs": records}, ensure_ascii=False), encoding="utf-8")
            return result
        Typesetting.typesetting_document = typeset
        if capture_only:
            return
        os.environ["PREVIEW_CAPTURE_CONTEXT"] = json.dumps([kind, sidecar, selected, input_path, args])
        from pdf2zh_next.main import cli
        sys.argv = ["pdf2zh", *args]
        try:
            status = cli()
        except SystemExit as exit:
            status = exit.code
    
    if status not in (None, 0):
        sys.exit(status)
    if records or not Path(sidecar).exists():
        Path(sidecar).write_text(json.dumps({"schema": 1, "engine": kind, "page": selected, "width": source_page.rect.width, "height": source_page.rect.height, "paragraphs": records}, ensure_ascii=False), encoding="utf-8")
    source_pdf.close()

if __name__ == "__main__":
    main()

elif __name__ == "__mp_main__" and "PREVIEW_CAPTURE_CONTEXT" in os.environ:
    main(capture_only=True)
