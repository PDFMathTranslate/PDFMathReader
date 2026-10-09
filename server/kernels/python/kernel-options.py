"""Print the app-safe command-line option metadata for an installed kernel."""

import argparse
import contextlib
import io
import json
import sys


# Standalone metadata probes also import the native layout dependencies.
import os

os.environ["ORT_DISABLE_TELEMETRY"] = "1"

SAFE_OPTIONS = {
    "pdf_math_fast": {
        "debug",
        "vfont",
        "vchar",
        "lang_in",
        "prompt",
        "compatible",
        "onnx",
        "backend",
        "config",
        "skip_subset_fonts",
        "ignore_cache",
    },
    "pdf_math_precise": {
        "min_text_length",
        "custom_system_prompt",
        "no_auto_extract_glossary",
        "primary_font_family",
        "formular_font_pattern",
        "formular_char_pattern",
        "split_short_lines",
        "short_line_split_factor",
        "skip_clean",
        "disable_rich_text_translate",
        "enhance_compatibility",
        "translate_table_text",
        "skip_scanned_detection",
        "ocr_workaround",
        "auto_enable_ocr_workaround",
        "no_merge_alternating_line_numbers",
        "no_remove_non_formula_lines",
        "non_formula_line_iou_threshold",
        "figure_table_protection_threshold",
        "skip_formula_offset_calculation",
    },
}


def model_defaults(value):
    flattened = {}

    def flatten(mapping):
        if isinstance(mapping, dict):
            for key, entry in mapping.items():
                if isinstance(entry, dict):
                    flatten(entry)
                else:
                    flattened[key] = entry

    flatten(value)
    return flattened


def parser_for(kind):
    if kind == "pdf_math_fast":
        from pdf2zh.pdf2zh import create_parser

        return create_parser(), {}
    if kind == "pdf_math_precise":
        from pdf2zh_next.config.cli_env_model import CLIEnvSettingsModel
        from pdf2zh_next.config.main import build_args_parser

        parser, _ = build_args_parser()
        return parser, model_defaults(CLIEnvSettingsModel().model_dump(mode="json"))
    raise ValueError(f"Unknown kernel: {kind}")


def option_metadata(kind):
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        parser, defaults = parser_for(kind)

    result = []
    for action in parser._actions:
        if action.dest not in SAFE_OPTIONS[kind]:
            continue
        flag = next((name for name in action.option_strings if name.startswith("--")), None)
        if not flag:
            continue
        boolean = isinstance(action, (argparse._StoreTrueAction, argparse._StoreFalseAction))
        option_type = (
            "boolean" if boolean else "number" if action.type in (int, float) else "string"
        )
        option = {
            "id": action.dest,
            "flag": flag,
            "type": option_type,
            "default": defaults.get(action.dest, action.default),
            "help": action.help or "",
            "label": action.dest.replace("_", " ").capitalize(),
        }
        if boolean:
            option["flagValue"] = isinstance(action, argparse._StoreTrueAction)
        if action.type is int:
            option["integer"] = True
        if action.choices:
            option["choices"] = list(action.choices)
        result.append(option)
    return result


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: kernel-options.py KERNEL_ID")
    print(json.dumps(option_metadata(sys.argv[1]), ensure_ascii=False))


if __name__ == "__main__":
    main()
