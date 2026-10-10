"""Check provider priority without installing native ONNX dependencies."""

import ast
import io
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

worker = Path(__file__).resolve().parents[2] / "server/kernels/python/kernel-worker.py"
tree = ast.parse(worker.read_text(encoding="utf-8"))
function = next(
    node
    for node in tree.body
    if isinstance(node, ast.FunctionDef) and node.name == "configure_gpu_inference"
)
namespace = {"sys": sys}
exec(compile(ast.Module(body=[function], type_ignores=[]), str(worker), "exec"), namespace)


class GpuInferenceTests(unittest.TestCase):
    def test_gpu_priority_and_cpu_fallback_for_both_platforms(self):
        for available in (
            ["CPUExecutionProvider", "DmlExecutionProvider"],
            ["CPUExecutionProvider", "CoreMLExecutionProvider"],
            ["CPUExecutionProvider"],
        ):
            calls = []

            class Session:
                def __init__(self, *args, **kwargs):
                    calls.append(args)

            runtime = SimpleNamespace(
                InferenceSession=Session,
                get_available_providers=lambda: available,
                SessionOptions=lambda: SimpleNamespace(optimized_model_filepath="cached.onnx"),
                ExecutionMode=SimpleNamespace(ORT_SEQUENTIAL="sequential"),
            )
            with (
                patch.dict(sys.modules, {"onnxruntime": runtime}),
                patch("sys.stderr", io.StringIO()),
            ):
                namespace["configure_gpu_inference"]()
                Session("model.onnx", providers=["CPUExecutionProvider"])
            expected = [name for name in available if name != "CPUExecutionProvider"]
            self.assertEqual(calls[0][2], [*expected, "CPUExecutionProvider"])
            if "DmlExecutionProvider" in available:
                self.assertFalse(calls[0][1].enable_mem_pattern)
                self.assertEqual(calls[0][1].execution_mode, "sequential")
            if "CoreMLExecutionProvider" in available:
                self.assertEqual(calls[0][1].optimized_model_filepath, "")
