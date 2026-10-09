"""Describe translation services exposed by an installed PDFMath kernel.

The Electron app runs this file with the Python interpreter belonging to the
selected kernel.  It deliberately asks the installed package for its own
provider and configuration metadata instead of maintaining a second list of
providers in the app.  The parent process supplies an isolated HOME/XDG
environment while probing, so importing the legacy kernel cannot update the
user's pdf2zh configuration.
"""

from __future__ import annotations

import contextlib
import ast
import importlib
import importlib.metadata
import inspect
import io
import json
import re
import sys
import textwrap
from collections.abc import Iterable
from typing import Any, get_args, get_origin


# Standalone metadata probes also import the native layout dependencies.
import os

os.environ["ORT_DISABLE_TELEMETRY"] = "1"

# These selections are owned by the Electron proxy rather than by either
# upstream kernel.  SiliconFlowFree is the precise kernel's default service;
# the proxy's automatic service covers that path as well.
EXCLUDED_SERVICE_IDS = frozenset(
    {"auto", "default", "apple-local", "apple_local", "siliconflowfree"}
)


# Upstream's validation methods make credentials required even though their
# Pydantic fields have a None default.  Keep this small map alongside the
# introspection so the emitted schema reflects the installed providers' real
# validation contract.
FAST_REQUIRED_FIELDS = {
    "deepl": {"DEEPL_AUTH_KEY"},
    "openai": {"OPENAI_API_KEY"},
    "azure-openai": {"AZURE_OPENAI_BASE_URL", "AZURE_OPENAI_API_KEY"},
    "modelscope": {"MODELSCOPE_API_KEY"},
    "zhipu": {"ZHIPU_API_KEY"},
    "silicon": {"SILICON_API_KEY"},
    "302ai": {"X302AI_API_KEY"},
    "gemini": {"GEMINI_API_KEY"},
    "azure": {"AZURE_API_KEY"},
    "tencent": {"TENCENTCLOUD_SECRET_ID", "TENCENTCLOUD_SECRET_KEY"},
    "anythingllm": {"AnythingLLM_APIKEY"},
    "dify": {"DIFY_API_KEY"},
    "grok": {"GROK_API_KEY"},
    "groq": {"GROQ_API_KEY"},
    "deepseek": {"DEEPSEEK_API_KEY"},
    "minimax": {"MINIMAX_API_KEY"},
    "openailiked": {"OPENAILIKED_BASE_URL", "OPENAILIKED_MODEL"},
    "qwen-mt": {"ALI_API_KEY"},
}

PRECISE_REQUIRED_FIELDS = {
    "openai": {"openai_api_key"},
    "deepl": {"deepl_auth_key"},
    "deepseek": {"deepseek_api_key"},
    "azureopenai": {"azure_openai_base_url", "azure_openai_api_key"},
    "modelscope": {"modelscope_api_key"},
    "zhipu": {"zhipu_api_key"},
    "siliconflow": {"siliconflow_api_key"},
    "tencentmechinetranslation": {
        "tencentcloud_secret_id",
        "tencentcloud_secret_key",
    },
    "gemini": {"gemini_api_key"},
    "azure": {"azure_api_key"},
    "anythingllm": {"anythingllm_apikey"},
    "dify": {"dify_apikey"},
    "grok": {"grok_api_key"},
    "groq": {"groq_api_key"},
    "qwenmt": {"qwenmt_api_key"},
    "openaicompatible": {
        "openai_compatible_base_url",
        "openai_compatible_api_key",
        "openai_compatible_model",
    },
    "aliyundashscope": {
        "aliyun_dashscope_base_url",
        "aliyun_dashscope_api_key",
        "aliyun_dashscope_model",
    },
    "clitranslator": {"clitranslator_command"},
}


def _human_label(value: str) -> str:
    """Turn an upstream identifier into a compact UI label."""

    value = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", value)
    words = [word for word in re.split(r"[_\-\s]+", value) if word]
    acronyms = {
        "api",
        "azure",
        "cjk",
        "cli",
        "id",
        "llm",
        "onnx",
        "pdf",
        "qps",
        "url",
    }
    return " ".join(
        word.upper() if word.lower() in acronyms else word.capitalize() for word in words
    )


def _json_value(value: Any) -> Any:
    """Convert Pydantic/enum defaults to JSON-safe primitive values."""

    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    enum_value = getattr(value, "value", None)
    if enum_value is not None and enum_value is not value:
        return _json_value(enum_value)
    try:
        json.dumps(value)
    except (TypeError, ValueError):
        return str(value)
    return value


def _field_type(annotation: Any) -> str:
    """Map an upstream scalar annotation to the app's field vocabulary."""

    args = get_args(annotation)
    candidates = args or (annotation,)
    if bool in candidates:
        return "boolean"
    if int in candidates or float in candidates:
        return "number"
    return "string"


def _is_secret(field_id: str) -> bool:
    upper = field_id.upper()
    return bool(
        re.search(
            r"(?:API[_]?KEY|AUTH[_]?KEY|ACCESS[_]?TOKEN|SECRET(?:_|$)|PASSWORD|(?:^|_)TOKEN(?:_|$))",
            upper,
        )
    )


def _field_default(field: Any) -> Any:
    value = getattr(field, "default", None)
    if value is None:
        undefined = getattr(importlib.import_module("pydantic_core"), "PydanticUndefined", object())
        if value is undefined or getattr(field, "is_required", lambda: False)():
            return None
    if value.__class__.__name__ == "PydanticUndefinedType":
        return None
    return _json_value(value)


def _field_schema(field_id: str, field: Any, required: bool) -> dict[str, Any]:
    annotation = getattr(field, "annotation", str)
    default = _field_default(field)
    result = {
        "id": field_id,
        "label": _human_label(field_id),
        "type": _field_type(annotation),
        "secret": _is_secret(field_id),
        "default": default,
        "required": bool(required),
    }
    origin = get_origin(annotation)
    if origin is not None and getattr(origin, "__name__", "") == "Literal":
        choices = [_json_value(value) for value in get_args(annotation)]
        if choices:
            result["choices"] = choices
    # Pydantic stores Field(ge=..., le=..., gt=..., lt=...) constraints in
    # metadata.  Keep the exclusive variants too; clients that only support
    # inclusive bounds can still use min/max conservatively.
    for detail in getattr(field, "metadata", ()):
        for source, target in (
            ("ge", "min"),
            ("le", "max"),
            ("gt", "exclusiveMin"),
            ("lt", "exclusiveMax"),
        ):
            value = getattr(detail, source, None)
            if value is not None:
                result[target] = _json_value(value)
    args = get_args(annotation)
    if annotation is int or int in args:
        result["integer"] = True
    elif annotation is float or float in args:
        result["integer"] = False
    return result


def _version(package_name: str, module: Any) -> str:
    value = getattr(module, "__version__", None)
    if isinstance(value, str) and value.strip():
        return value.strip()
    try:
        return importlib.metadata.version(package_name)
    except importlib.metadata.PackageNotFoundError:
        return "unknown"


def _service_result(
    service_id: str, label: str, fields: Iterable[dict[str, Any]]
) -> dict[str, Any]:
    if service_id in EXCLUDED_SERVICE_IDS:
        raise ValueError(f"excluded service: {service_id}")
    return {
        "id": service_id,
        "label": label or _human_label(service_id),
        "fields": list(fields),
    }


FAST_FIELD_PREFIXES = {
    "openai": "OPENAI_",
    "azure-openai": "AZURE_OPENAI_",
    "modelscope": "MODELSCOPE_",
    "zhipu": "ZHIPU_",
    "silicon": "SILICON_",
    "302ai": "X302AI_",
    "gemini": "GEMINI_",
    "azure": "AZURE_",
    "tencent": "TENCENTCLOUD_",
    "anythingllm": "ANYTHINGLLM_",
    "dify": "DIFY_",
    "grok": "GROK_",
    "groq": "GROQ_",
    "deepseek": "DEEPSEEK_",
    "minimax": "MINIMAX_",
    "openailiked": "OPENAILIKED_",
    "ollama": "OLLAMA_",
    "xinference": "XINFERENCE_",
    "deepl": "DEEPL_",
    "deeplx": "DEEPLX_",
    "qwen-mt": "ALI_",
}


def _fast_field_id(service_id: str, env_id: str) -> str:
    """Expose compact per-service ids while retaining the exact env key."""

    prefix = FAST_FIELD_PREFIXES.get(service_id, "")
    suffix = env_id[len(prefix) :] if prefix and env_id.upper().startswith(prefix) else env_id
    suffix = suffix.lower().replace("apikey", "api_key")
    return suffix


def _fast_converter_names(converter: Any) -> list[str]:
    """Read the concrete provider list from TranslateConverter itself."""

    try:
        source = textwrap.dedent(inspect.getsource(converter.TranslateConverter.__init__))
        tree = ast.parse(source)
    except (AttributeError, OSError, SyntaxError):
        return []
    for node in ast.walk(tree):
        if not isinstance(node, ast.For) or not isinstance(node.iter, (ast.List, ast.Tuple)):
            continue
        names = [item.id for item in node.iter.elts if isinstance(item, ast.Name)]
        if names:
            return names
    return []


def _fast_services() -> tuple[str, list[dict[str, Any]]]:
    package = importlib.import_module("pdf2zh")
    translators = importlib.import_module("pdf2zh.translator")
    converter = importlib.import_module("pdf2zh.converter")
    converter_names = _fast_converter_names(converter)
    services: list[dict[str, Any]] = []
    seen: set[str] = set()
    candidates = [
        getattr(converter, name, getattr(translators, name, None)) for name in converter_names
    ]
    for candidate in candidates:
        if not isinstance(candidate, type):
            continue
        service_id = getattr(candidate, "name", None)
        if not isinstance(service_id, str) or not service_id or service_id in seen:
            continue
        if service_id == "base":
            continue
        # These are the concrete classes used by pdf2zh.converter.  Checking
        # the module keeps imported helper classes out of the result.
        if getattr(candidate, "__module__", None) != translators.__name__:
            continue
        envs = getattr(candidate, "envs", {})
        if not isinstance(envs, dict):
            envs = {}
        required = FAST_REQUIRED_FIELDS.get(service_id, set())
        fields = [
            {
                "id": _fast_field_id(service_id, key),
                "label": _human_label(_fast_field_id(service_id, key)),
                "type": "number"
                if isinstance(value, (int, float)) and not isinstance(value, bool)
                else "boolean"
                if isinstance(value, bool)
                else "string",
                "secret": _is_secret(key),
                "default": _json_value(value),
                "required": key in required,
                "env": key,
            }
            for key, value in envs.items()
            if isinstance(key, str)
        ]
        if service_id not in EXCLUDED_SERVICE_IDS:
            service = _service_result(
                service_id, _human_label(candidate.__name__.removesuffix("Translator")), fields
            )
            service["supportsPrompt"] = bool(getattr(candidate, "CustomPrompt", False))
            services.append(service)
            seen.add(service_id)
    return _version("pdf2zh", package), services


def _precise_services() -> tuple[str, list[dict[str, Any]]]:
    package = importlib.import_module("pdf2zh_next")
    model_module = importlib.import_module("pdf2zh_next.config.translate_engine_model")
    parser_module = importlib.import_module("pdf2zh_next.config.main")
    parser, _ = parser_module.build_args_parser()
    actions = {action.dest: action for action in parser._actions}
    metadata = getattr(model_module, "TRANSLATION_ENGINE_METADATA", ())
    unsupported = getattr(model_module, "NOT_SUPPORTED_TRANSLATION_ENGINE_SETTING_TYPE", None)
    services: list[dict[str, Any]] = []
    for entry in metadata:
        service_id = str(getattr(entry, "cli_flag_name", ""))
        model = getattr(entry, "setting_model_type", None)
        if not service_id or model is None or service_id in EXCLUDED_SERVICE_IDS:
            continue
        if unsupported not in (None, type(None)):
            try:
                if isinstance(model, type) and (
                    model is unsupported or isinstance(model(), unsupported)
                ):
                    continue
            except (TypeError, ValueError):
                pass
        provider_action = actions.get(service_id)
        if (
            provider_action is None
            or f"--{service_id.replace('_', '-')}" not in provider_action.option_strings
        ):
            continue
        fields = []
        required_names = PRECISE_REQUIRED_FIELDS.get(service_id, set())
        for field_id, field in getattr(model, "model_fields", {}).items():
            if field_id in {"translate_engine_type", "support_llm"}:
                continue
            action = actions.get(field_id)
            flag = f"--{field_id.replace('_', '-')}"
            if action is None or flag not in action.option_strings:
                continue
            is_required = bool(getattr(field, "is_required", lambda: False)())
            schema = _field_schema(field_id, field, is_required or field_id in required_names)
            schema["env"] = f"PDF2ZH_{field_id.upper()}"
            schema["flag"] = flag
            if action.choices:
                schema["choices"] = [_json_value(value) for value in action.choices]
            fields.append(schema)
        label = str(getattr(entry, "translate_engine_type", "")) or _human_label(service_id)
        service = _service_result(service_id, label, fields)
        service["supportsPrompt"] = bool(getattr(entry, "support_llm", False))
        services.append(service)
    return _version("pdf2zh-next", package), services


def describe(kernel: str) -> dict[str, Any]:
    if kernel == "pdf_math_fast":
        version, services = _fast_services()
    elif kernel == "pdf_math_precise":
        version, services = _precise_services()
    else:
        raise ValueError(f"Unknown kernel: {kernel}")
    return {"id": kernel, "services": services, "version": version}


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: kernel-services.py KERNEL_ID")
    # Some optional upstream dependencies log during import.  Keep stdout a
    # single JSON document so the Node caller can parse it without guessing.
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        result = describe(sys.argv[1])
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
