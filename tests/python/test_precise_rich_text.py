"""Translated BabelDOC rich-text tags are rewritten to the form its parser accepts."""

import ast
import json
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
            "precise_number_unnamed_rich_text",
            "precise_restore_rich_text",
            "precise_restore_batch_rich_text",
            "precise_composition_text",
            "fast_formula_placeholders",
        }
    )
    or (
        isinstance(node, ast.Assign)
        and any(
            getattr(target, "id", None)
            in {
                "PRECISE_RICH_TEXT_LEFT",
                "PRECISE_UNNUMBERED_PAIR",
                "PRECISE_SINGLE_PROMPT_MARKER",
                "PRECISE_BATCH_PROMPT_MARKER",
                "FAST_FORMULA_PLACEHOLDER",
            }
            for target in node.targets
        )
    )
]
namespace = {"re": re, "json": json}
exec(compile(ast.Module(body=nodes, type_ignores=[]), str(worker), "exec"), namespace)
canonical = namespace["precise_canonical_rich_text_tags"]
restore = namespace["precise_restore_rich_text"]
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

    def test_dropped_id_is_restored_from_source(self):
        source = "an acute <style id='1'>dictator’s dilemma</style> (Francisco, 2005)"
        self.assertEqual(
            canonical("一个尖锐的<code>独裁者困境</code>（Francisco, 2005）", source),
            "一个尖锐的<style id='1'>独裁者困境</style>（Francisco, 2005）",
        )
        self.assertEqual(
            canonical(
                "<i>甲</i>与<style id='2'>乙</style>和<em>丙</em>",
                "<style id='1'>a</style> <style id='2'>b</style> <style id='3'>c</style>",
            ),
            "<style id='1'>甲</style>与<style id='2'>乙</style>和<style id='3'>丙</style>",
        )

    def test_unmatched_or_literal_tags_are_left_alone(self):
        source = "<style id='1'>a</style> and <style id='2'>b</style>"
        self.assertEqual(canonical("<code>甲</code>与乙", source), "<code>甲</code>与乙")
        literal = "use <code>x</code> and <style id='1'>y</style>"
        self.assertEqual(canonical("用 <code>x</code> 和 y", literal), "用 <code>x</code> 和 y")

    def test_single_prompt_uses_text_after_marker(self):
        prompt = "Keep tags (e.g. <style id='9'>) …\nNow translate the following text:\nan <style id='1'>acute</style> dilemma"
        self.assertEqual(
            restore(prompt, "一个<code>尖锐</code>困境"), "一个<style id='1'>尖锐</style>困境"
        )

    def test_batch_reply_is_repaired_per_item(self):
        example = '"input": "{v1}<style id=\'2\'>hello</style>, world!"'
        inputs = [
            {"id": 1, "input": "plain text"},
            {"id": 2, "input": "an <style id='1'>acute dictator’s dilemma</style>"},
        ]
        prompt = f"Example {example}\n## Here is the input:\n{json.dumps(inputs)}"
        reply = json.dumps(
            [{"id": 1, "output": "纯文本"}, {"id": 2, "output": "一个<code>独裁者困境</code>"}],
            ensure_ascii=False,
        )
        self.assertEqual(
            json.loads(restore(prompt, reply)),
            [
                {"id": 1, "output": "纯文本"},
                {"id": 2, "output": "一个<style id='1'>独裁者困境</style>"},
            ],
        )
        untouched = json.dumps([{"id": 1, "output": "纯文本"}], ensure_ascii=False)
        self.assertEqual(restore(prompt, untouched), untouched)

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
