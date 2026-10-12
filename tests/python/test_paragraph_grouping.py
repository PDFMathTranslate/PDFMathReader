"""Pre-translation Fast paragraph grouping stays bounded and gateway-owned."""

import ast
import json
import math
from pathlib import Path
from types import SimpleNamespace
import unittest
import threading
import time
from unittest.mock import patch

worker = Path(__file__).resolve().parents[2] / "server/kernels/python/kernel-worker.py"
tree = ast.parse(worker.read_text(encoding="utf-8"))
names = {
    "fast_combine_paragraph_text",
    "fast_paragraph_continuation_candidate",
    "fast_classify_paragraph_continuation",
    "fast_group_paragraphs",
}
functions = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in names]
namespace = {"json": json, "math": math, "re": __import__("re")}
exec(compile(ast.Module(body=functions, type_ignores=[]), str(worker), "exec"), namespace)


def paragraph(x0, x1, y0=100, y1=112, size=10, brk=False):
    return SimpleNamespace(x0=x0, x1=x1, y0=y0, y1=y1, size=size, brk=brk, x=x0, y=y1)


class ParagraphGroupingTests(unittest.TestCase):
    def test_judgment_restores_italic_words_and_sends_layout_without_changing_placeholders(self):
        calls = []

        def classify(before, after, _url, _token, layout):
            calls.append((before, after, layout))
            return True

        glyph = SimpleNamespace(get_text=lambda: "predictive")
        with patch.dict(namespace, {"fast_classify_paragraph_continuation": classify}):
            result, _ = namespace["fast_group_paragraphs"](
                ["They can be used for {v0}", "purposes. Based on machine learning,"],
                [paragraph(51, 289, 100, 135), paragraph(51, 289, 62.5, 97.5)],
                "http://gateway",
                "job-token",
                [[glyph]],
            )
        self.assertEqual(result, ["They can be used for {v0} purposes. Based on machine learning,"])
        self.assertEqual(
            calls,
            [
                (
                    "They can be used for predictive",
                    "purposes. Based on machine learning,",
                    {"sameColumn": True, "gapInEm": 0.25, "afterIndentInEm": 0},
                )
            ],
        )

    def test_invisible_space_fragments_do_not_interrupt_real_paragraph(self):
        texts = [
            "In our Big Data society, their",
            "  ",
            "behaviours are collected",
            "\n",
            "from work and",
            " ",
            "communication to leisure.",
        ]
        boxes = [
            paragraph(51, 289, 306, 316),
            paragraph(289, 291, 306, 316),
            paragraph(51, 289, 269, 303.5),
            paragraph(289, 291, 269, 279),
            paragraph(51, 289, 256.5, 266.5),
            paragraph(289, 291, 256.5, 266.5),
            paragraph(51, 289, 219, 254),
        ]
        calls = []

        def classify(before, after, *_):
            calls.append((before, after))
            return True

        with patch.dict(namespace, {"fast_classify_paragraph_continuation": classify}):
            result, grouped = namespace["fast_group_paragraphs"](
                texts, boxes, "http://gateway", "job-token"
            )
        self.assertEqual(
            result,
            [
                "In our Big Data society, their behaviours are collected from work and communication to leisure."
            ],
        )
        self.assertEqual(len(grouped), 1)
        self.assertEqual(len(calls), 3)
        self.assertEqual(
            (grouped[0].x0, grouped[0].x1, grouped[0].y0, grouped[0].y1), (51, 289, 219, 316)
        )

    def test_disabled_and_failed_checks_preserve_prose_and_formula_boundaries(self):
        texts = ["Prose before", " ", "{v3}", "Prose after"]
        boxes = [paragraph(51, 289, 300 - i * 12.5, 310 - i * 12.5) for i in range(4)]
        with patch.dict(namespace, {"fast_classify_paragraph_continuation": lambda *_: True}):
            result, _ = namespace["fast_group_paragraphs"](
                texts, boxes, "http://gateway", "job-token"
            )
            disabled, _ = namespace["fast_group_paragraphs"](texts, boxes, "", "")
        self.assertEqual(result, ["Prose before", "{v3}", "Prose after"])
        self.assertEqual(disabled, texts)

        def fail(*_):
            raise OSError("gateway unavailable")

        with patch.dict(namespace, {"fast_classify_paragraph_continuation": fail}):
            result, _ = namespace["fast_group_paragraphs"](
                ["first", "second"], boxes[:2], "http://gateway", "job-token"
            )
        self.assertEqual(result, ["first", "second"])

    def test_checks_use_four_threads_and_keep_order(self):
        texts = ["fragment " + str(i) for i in range(7)]
        boxes = [paragraph(51, 289, 300 - i * 12.5, 310 - i * 12.5) for i in range(7)]
        active = peak = 0
        lock = threading.Lock()

        def classify(*_):
            nonlocal active, peak
            with lock:
                active += 1
                peak = max(peak, active)
            time.sleep(0.02)
            with lock:
                active -= 1
            return True

        with patch.dict(namespace, {"fast_classify_paragraph_continuation": classify}):
            result, _ = namespace["fast_group_paragraphs"](
                texts, boxes, "http://gateway", "job-token"
            )
        self.assertEqual(result, [" ".join(texts)])
        self.assertEqual(peak, 4)

    def test_same_line_fragments_are_merged_before_translation(self):
        first = paragraph(40, 140)
        second = paragraph(141, 230)
        calls = []

        def classify(before, after, url, token, *_):
            calls.append((before, after, url, token))
            return True

        with patch.dict(namespace, {"fast_classify_paragraph_continuation": classify}):
            texts, paragraphs = namespace["fast_group_paragraphs"](
                ["The mechanism", "depends on"],
                [first, second],
                "http://gateway/paragraph",
                "job-token",
            )

        self.assertEqual(texts, ["The mechanism depends on"])
        self.assertEqual(len(paragraphs), 1)
        self.assertEqual((paragraphs[0].x0, paragraphs[0].x1), (40.0, 230.0))
        self.assertEqual(paragraphs[0]._preview_source_texts, ["The mechanism", "depends on"])
        self.assertEqual(
            calls, [("The mechanism", "depends on", "http://gateway/paragraph", "job-token")]
        )

    def test_barrier_and_geometry_keep_fragments_separate(self):
        first = paragraph(40, 140)
        barrier = paragraph(40, 130, y0=40, y1=52)
        third = paragraph(40, 130, y0=20, y1=32)
        other_column = paragraph(240, 340, y0=100, y1=300)
        calls = []

        def classify(before, after, url, token, *_):
            calls.append((before, after))
            return True

        with patch.dict(namespace, {"fast_classify_paragraph_continuation": classify}):
            texts, paragraphs = namespace["fast_group_paragraphs"](
                ["The mechanism", "1. A separate item", "The conclusion"],
                [first, barrier, third],
                "http://gateway/paragraph",
                "job-token",
            )

        self.assertEqual(texts, ["The mechanism", "1. A separate item", "The conclusion"])
        self.assertEqual(len(paragraphs), 3)
        self.assertEqual(calls, [])

        with patch.dict(namespace, {"fast_classify_paragraph_continuation": classify}):
            texts, paragraphs = namespace["fast_group_paragraphs"](
                ["Left column paragraph", "Right column paragraph"],
                [paragraph(40, 220, y0=100, y1=300), other_column],
                "http://gateway/paragraph",
                "job-token",
            )
        self.assertEqual(texts, ["Left column paragraph", "Right column paragraph"])
        self.assertEqual(len(paragraphs), 2)
        self.assertEqual(calls, [])

    def test_gateway_accepts_only_classified_combine(self):
        responses = []

        class Response:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self):
                return json.dumps({"status": "classified", "combine": True}).encode()

        def urlopen(request, timeout):
            responses.append((request, timeout))
            return Response()

        with patch("urllib.request.urlopen", urlopen):
            result = namespace["fast_classify_paragraph_continuation"](
                "before fragment", "after fragment", "http://gateway/paragraph", "job-token"
            )

        self.assertTrue(result)
        self.assertEqual(responses[0][1], 7)
        request = responses[0][0]
        self.assertEqual(request.get_header("Authorization"), "Bearer job-token")
        self.assertEqual(
            json.loads(request.data),
            {"before": "before fragment", "after": "after fragment", "layout": None},
        )

    def test_wrapped_multiline_fragments_merge_with_small_vertical_gap(self):
        before = paragraph(51, 288, y0=100, y1=135)
        after = paragraph(51, 288, y0=62.5, y1=97.5)
        self.assertTrue(
            namespace["fast_paragraph_continuation_candidate"](
                "first wrapped fragment", "second wrapped fragment", before, after
            )
        )

        def classify(*_):
            return True

        with patch.dict(namespace, {"fast_classify_paragraph_continuation": classify}):
            texts, paragraphs = namespace["fast_group_paragraphs"](
                ["first wrapped fragment", "second wrapped fragment"],
                [before, after],
                "http://gateway/paragraph",
                "job-token",
            )
        self.assertEqual(texts, ["first wrapped fragment second wrapped fragment"])
        self.assertEqual(len(paragraphs), 1)


if __name__ == "__main__":
    unittest.main()
