# Contributing Agents

This document defines the strict workflow for AI agents modifying the reTerminal Dashboard Designer.

## The 8-Step Workflow

1.  **Read Feature Structure**:
    -   Check `manifest.json` (if exists) or `__init__.py`.
    -   Read `ARCHITECTURE.md` to understand where your changes fit.

2.  **Check Dependencies**:
    -   Does your new feature require new fonts? (Update `services/font_manager.py`)
    -   Does it require new ESPHome components?

3.  **Modify Schema (`schema.json`)**:
    -   Define properties using standard JSON Schema.
    -   Use `ui:widget` hints for the frontend editor.
    -   **Strictly** use `"type": "object"`.

4.  **Update Generator (`generator.py`)**:
    -   Implement the `FeatureBase` interface.
    -   Ensure `generate_yaml` returns valid ESPHome YAML.

5.  **Update Renderer (`render.js`)**:
    -   Implement the `render(widget, ctx)` function.
    -   Ensure it handles all properties defined in `schema.json`.

6.  **Add Test Data (`test_data.json`)**:
    -   Provide a valid JSON object representing a configured instance of this widget.

7.  **Validate**:
    -   Run `python3 scripts/validate_features.py`.

8.  **Done**:
    -   Update `task.md` and `walkthrough.md`.

## Code Style
-   **Frontend**: ES Modules, no global variables (except `window.reTerminalApp` for debugging).
-   **Backend**: Python 3.9+, typed hints where possible.
-   **Comments**: Explain *why*, not just *what*.
