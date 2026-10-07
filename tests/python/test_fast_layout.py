"""Regression checks for Fast's protected-table anchor and prose indentation."""

import ast
from pathlib import Path
import re
import unittest

worker = Path(__file__).resolve().parents[2] / "server/kernels/python/kernel-worker.py"
tree = ast.parse(worker.read_text())
function = next(
    node
    for node in tree.body
    if isinstance(node, ast.FunctionDef) and node.name == "fast_paragraph_indent"
)
namespace = {"re": re}
exec(compile(ast.Module(body=[function], type_ignores=[]), str(worker), "exec"), namespace)
indent = namespace["fast_paragraph_indent"]


class FastLayoutTests(unittest.TestCase):
    def test_retained_table_keeps_first_glyph_anchor(self):
        # The protected table's first glyph is a column header to the right of
        # its left edge. Resetting this anchor also displaces its rows and rules.
        for language in ("zh", "zh-CN", "ja", "ko"):
            for text in ("{v1}", " {v1} ", "{{v1}}", "{v0} {v1}"):
                self.assertEqual(indent(text, 281, 77, language), (text, 281))

    def test_cjk_prose_still_receives_first_line_indent(self):
        self.assertEqual(indent("译文", 100, 77, "zh"), ("\u3000\u3000译文", 77))
        self.assertEqual(indent("译文 {v1}", 100, 77, "zh"), ("\u3000\u3000译文 {v1}", 77))

    def test_non_cjk_and_unindented_text_keep_position(self):
        self.assertEqual(indent("Translation", 100, 77, "en"), ("Translation", 100))
        self.assertEqual(indent("译文", 77, 77, "zh"), ("译文", 77))


if __name__ == "__main__":
    unittest.main()
