"""Translated BabelDOC rich-text tags are rewritten to the form its parser accepts."""

import ast
from pathlib import Path
import re
import unittest

worker = Path(__file__).resolve().parents[2] / "server/kernels/python/kernel-worker.py"
tree = ast.parse(worker.read_text(encoding="utf-8"))
nodes = [
    node
    for node in tree.body
    if (
        isinstance(node, ast.FunctionDef)
        and node.name
        in {
            "precise_canonical_rich_text_tags",
            "precise_composition_text",
            "fast_formula_placeholders",
        }
    )
    or (
        isinstance(node, ast.Assign)
        and any(
            getattr(target, "id", None) in {"PRECISE_RICH_TEXT_LEFT", "FAST_FORMULA_PLACEHOLDER"}
            for target in node.targets
        )
    )
]
namespace = {"re": re}
exec(compile(ast.Module(body=nodes, type_ignores=[]), str(worker), "exec"), namespace)
canonical = namespace["precise_canonical_rich_text_tags"]
composition_text = namespace["precise_composition_text"]
fast_formulas = namespace["fast_formula_placeholders"]


class PreciseRichTextTests(unittest.TestCase):
    def test_translated_tag_name_becomes_style(self):
        self.assertEqual(
            canonical("<样式 id='1'>谁</样式>: 是"),
            "<style id='1'>谁</style>: 是",
        )

    def test_requoted_and_spaced_tags_become_canonical(self):
        self.assertEqual(
            canonical('< STYLE id = "2" >媒体</ Style >与<样式 id=3>报纸</样式 >'),
            "<style id='2'>媒体</style>与<style id='3'>报纸</style>",
        )

    def test_unrelated_tags_and_comparisons_are_preserved(self):
        for text in ["x < y > z", "<b>粗</b>", "</样式> without opener", None]:
            self.assertEqual(canonical(text), text)

    def test_doubled_formula_braces_become_one_placeholder(self):
        self.assertEqual(canonical("见 {{v1}} 与 {{ v 2 }}"), "见 {v1} 与 { v 2 }")
        self.assertEqual(canonical("集合 {a, b}"), "集合 {a, b}")

    def test_composition_text_joins_styled_runs_and_formulas(self):
        def node(**fields):
            return type("Node", (), fields)()

        styled = node(pdf_same_style_unicode_characters=node(unicode="谁"))
        formula = node(pdf_formula=node(pdf_character=[node(char_unicode="x")]))
        plain = node(pdf_same_style_unicode_characters=node(unicode=": 是 "))
        self.assertEqual(
            "".join(composition_text(c) for c in [styled, plain, formula]),
            "谁: 是 x",
        )


class FastFormulaPlaceholderTests(unittest.TestCase):
    def test_doubled_braces_collapse(self):
        self.assertEqual(fast_formulas("令 {{v1}} 成立", "Let {v1} hold"), "令 {v1} 成立")

    def test_wildcard_resolves_with_one_source_formula(self):
        self.assertEqual(fast_formulas("令 {v*} 成立", "Let {v3} hold"), "令 {v3} 成立")

    def test_ambiguous_wildcard_keeps_source(self):
        source = "Let {v0} and {v1} hold"
        self.assertEqual(fast_formulas("令 {v*} 成立", source), source)

    def test_text_without_placeholders_is_unchanged(self):
        for text in ["普通文本", None]:
            self.assertEqual(fast_formulas(text, "x"), text)


if __name__ == "__main__":
    unittest.main()
