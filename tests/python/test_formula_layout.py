"""Formula boxes come from the detector, never from protected table placeholders."""

import ast
from pathlib import Path
from types import SimpleNamespace
import unittest

worker = Path(__file__).resolve().parents[2] / "server/kernels/python/kernel-worker.py"
tree = ast.parse(worker.read_text())
function = next(
    node
    for node in ast.walk(tree)
    if isinstance(node, ast.FunctionDef) and node.name == "formula_predict"
)


class Box:
    def __init__(self, cls, rect):
        self.cls = cls
        self.xyxy = SimpleNamespace(squeeze=lambda: rect)


class FormulaLayoutTests(unittest.TestCase):
    def test_detector_boxes_keep_display_coordinates_and_ignore_tables(self):
        result = SimpleNamespace(
            names=["table", "isolate_formula", "text"],
            boxes=[Box(0, [10, 20, 100, 90]), Box(1, [40, 60, 180, 120]), Box(2, [0, 0, 200, 200])],
        )
        records = []
        results = [result]
        namespace = {
            "original_predict": lambda *a, **k: results,
            "source_page": SimpleNamespace(rect=SimpleNamespace(width=100, height=200)),
            "records": records,
            "selected": 7,
        }
        exec(compile(ast.Module(body=[function], type_ignores=[]), str(worker), "exec"), namespace)
        returned = namespace["formula_predict"](None, SimpleNamespace(shape=(400, 200, 3)))
        self.assertIs(returned, results)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["sourceBox"], {"x": 20, "y": 30, "width": 70, "height": 30})
        self.assertEqual(records[0]["translatedBox"], records[0]["sourceBox"])
        self.assertTrue(records[0]["isFormula"])
        self.assertEqual(records[0]["page"], 7)


if __name__ == "__main__":
    unittest.main()
