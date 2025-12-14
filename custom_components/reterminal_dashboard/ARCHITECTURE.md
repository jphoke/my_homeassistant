# Architecture Overview

The reTerminal Dashboard Designer is being refactored into a **Modular Feature Architecture**.

## Core Principles
1.  **Modularity**: Logic is split into semantic modules (ES Modules).
2.  **Explicit Context**: Every feature and module is self-documenting.
3.  **Strict Interfaces**: Communication between modules and the backend happens through defined APIs.

## System Design

### Frontend (`frontend/js/`)
The frontend uses native ES Modules (no bundler required).

-   **`main.js`**: Application entry point. Initializes the core systems.
-   **`core/`**:
    -   `state.js`: Centralized state management (Store pattern).
    -   `events.js`: Global event bus.
    -   `canvas.js`: Handles the visual editor (rendering, drag-and-drop, snapping).
    -   `properties.js`: Generates the side panel for editing widget properties.
    -   `sidebar.js`: Manages the widget palette and page navigation.
-   **`io/`**:
    -   `file_ops.js`: Handles saving/loading JSON layouts.
    -   `yaml_export.js`: Generates the ESPHome YAML configuration client-side.
-   **`utils/`**: Shared helper functions (UUID, colors, DOM).

### Backend (`custom_components/reterminal_dashboard/`)
The backend is a thin orchestrator that delegates logic to "Feature Pods".

-   **`yaml_generator.py`**: Iterates through the layout and calls `FeatureRegistry` to generate YAML.
-   **`feature_registry.py`**: Discovers and registers available widgets.

### Feature Pods (`features/`)
Each widget is a self-contained "Pod" in `features/<widget_id>/`.

-   `__init__.py`: Python registration.
-   `schema.json`: JSON Schema defining the widget's properties.
-   `generator.py`: Python logic to generate ESPHome YAML.
-   `render.js`: JS module to render the widget in the editor canvas.
-   `test_data.json`: Mock data for testing.

## Data Flow
1.  **User Action**: User drags a widget to the canvas.
2.  **Frontend**: `canvas.js` renders the widget using `render.js` from the feature pod.
3.  **State Update**: `state.js` updates the global application state.
4.  **Save**: `file_ops.js` saves the state to `dashboard.json`.
5.  **Generate**: `yaml_export.js` (or backend) converts the state to ESPHome YAML using `generator.py` logic.
