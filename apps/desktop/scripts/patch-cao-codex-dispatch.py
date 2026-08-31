#!/usr/bin/env python3
"""Apply the Task Hub compatibility guard for CAO's Codex workflow lifecycle.

CAO 2.5.0 clears the rolling output buffer when dispatching a new prompt, but
leaves the previous ready status latched until the Codex TUI renders its next
PROCESSING frame.  The workflow runner can observe that stale COMPLETED value
in the gap and tear the worker down before ``workflow_return`` is emitted.  Its
Codex MCP config also forwards only ``CAO_TERMINAL_ID``, so the MCP subprocess
cannot see the workflow run/step routing variables that exist in the tmux pane.

The CAO provider contract already exposes ``assume_processing_on_dispatch``
for exactly this class of full-screen TUI.  This patch only opts Codex into the
existing contract.  It is idempotent and stops safely when upstream changes the
source shape or provides its own override.
"""

from __future__ import annotations

import importlib.util
import os
from pathlib import Path
import re
import sys


DISPATCH_PATCH_MARKER = "TASK_HUB_CODEX_DISPATCH_GUARD"
CONTEXT_PATCH_MARKER = "TASK_HUB_CODEX_WORKFLOW_CONTEXT"
CLASS_MARKER = "class CodexProvider(BaseProvider):"
INSERT_AFTER = "    supports_screen_detection = True\n"
PATCH_TEXT = (
    "\n"
    "    # TASK_HUB_CODEX_DISPATCH_GUARD: prevent the workflow completion wait\n"
    "    # from observing the previous turn's cached COMPLETED state before\n"
    "    # Codex paints the PROCESSING frame for the newly dispatched prompt.\n"
    "    assume_processing_on_dispatch = True\n"
)
CONTEXT_NEEDLE = (
    '                    if "CAO_TERMINAL_ID" not in env_vars:\n'
    '                        env_vars = list(env_vars) + ["CAO_TERMINAL_ID"]\n'
)
CONTEXT_PATCH_TEXT = (
    "                    # TASK_HUB_CODEX_WORKFLOW_CONTEXT: Codex starts MCP\n"
    "                    # servers with an explicit env allowlist. Forward the\n"
    "                    # workflow routing identity that already exists in the\n"
    "                    # pane so workflow_return reaches the correct step.\n"
    "                    inherited_env_vars = (\n"
    '                        "CAO_TERMINAL_ID",\n'
    '                        "CAO_WORKFLOW_RUN_ID",\n'
    '                        "CAO_WORKFLOW_STEP_ID",\n'
    "                    )\n"
    "                    env_vars = list(env_vars)\n"
    "                    for inherited_env_var in inherited_env_vars:\n"
    "                        if inherited_env_var not in env_vars:\n"
    "                            env_vars.append(inherited_env_var)\n"
)


def fail(message: str) -> int:
    print(f"CAO_CODEX_DISPATCH_GUARD=error:{message}", file=sys.stderr)
    return 1


def main() -> int:
    spec = importlib.util.find_spec("cli_agent_orchestrator.providers.codex")
    if spec is None or not spec.origin:
        return fail("codex-provider-not-found")

    source_path = Path(spec.origin).resolve()
    if source_path.name != "codex.py" or "cli_agent_orchestrator" not in source_path.parts:
        return fail("unexpected-provider-path")

    source = source_path.read_text(encoding="utf-8")
    class_start = source.find(CLASS_MARKER)
    if class_start < 0:
        return fail("codex-provider-class-not-found")

    next_class = source.find("\nclass ", class_start + len(CLASS_MARKER))
    class_source = source[class_start : next_class if next_class >= 0 else len(source)]
    patched_any = False
    upstream_override = False

    # If upstream adds its own override, leave it untouched.  A property or a
    # class-level boolean both satisfy terminal_service's provider contract.
    if DISPATCH_PATCH_MARKER not in class_source:
        if re.search(r"^\s+(?:def\s+)?assume_processing_on_dispatch\b", class_source, re.MULTILINE):
            upstream_override = True
        else:
            marker_offset = class_source.find(INSERT_AFTER)
            if marker_offset < 0 or class_source.count(INSERT_AFTER) != 1:
                return fail("screen-detection-marker-not-found")
            absolute_offset = class_start + marker_offset + len(INSERT_AFTER)
            source = source[:absolute_offset] + PATCH_TEXT + source[absolute_offset:]
            patched_any = True

    next_class = source.find("\nclass ", class_start + len(CLASS_MARKER))
    class_source = source[class_start : next_class if next_class >= 0 else len(source)]
    if CONTEXT_PATCH_MARKER not in class_source:
        has_upstream_context = (
            "CAO_WORKFLOW_RUN_ID" in class_source
            and "CAO_WORKFLOW_STEP_ID" in class_source
            and "env_vars" in class_source
        )
        if has_upstream_context:
            upstream_override = True
        elif class_source.count(CONTEXT_NEEDLE) == 1:
            absolute_offset = class_start + class_source.find(CONTEXT_NEEDLE)
            source = (
                source[:absolute_offset]
                + CONTEXT_PATCH_TEXT
                + source[absolute_offset + len(CONTEXT_NEEDLE) :]
            )
            patched_any = True
        else:
            return fail("codex-mcp-env-marker-not-found")

    try:
        compile(source, str(source_path), "exec")
    except SyntaxError:
        return fail("patched-provider-did-not-compile")

    if patched_any:
        temporary_path = source_path.with_suffix(".py.task-hub.tmp")
        temporary_path.write_text(source, encoding="utf-8")
        os.chmod(temporary_path, source_path.stat().st_mode)
        os.replace(temporary_path, source_path)
        print("CAO_CODEX_DISPATCH_GUARD=patched")
    elif upstream_override:
        print("CAO_CODEX_DISPATCH_GUARD=upstream")
    else:
        print("CAO_CODEX_DISPATCH_GUARD=ready")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
