// Imports removed - using global scope
// AppState from state.js
// on, EVENTS from events.js
// SNAP_DISTANCE from constants.js
// getColorStyle from device.js
// FeatureRegistry from feature_registry.js

class Canvas {
    constructor() {
        this.canvas = document.getElementById("canvas");
        this.canvasContainer = document.getElementById("canvasContainer");
        this.dragState = null;
        this.init();
    }

    init() {
        // Subscribe to events
        on(EVENTS.STATE_CHANGED, () => this.render());
        on(EVENTS.PAGE_CHANGED, () => this.render());
        on(EVENTS.SELECTION_CHANGED, () => this.render());
        on(EVENTS.SETTINGS_CHANGED, () => this.render());
        on(EVENTS.ZOOM_CHANGED, () => this.applyZoom());

        this.setupInteractions();
        this.setupZoomControls();
        this.render();
        this.applyZoom();

        // Start a 1-second interval to update time-dependent widgets (like datetime)
        if (this.updateInterval) clearInterval(this.updateInterval);
        this.updateInterval = setInterval(() => {
            // Only re-render if there is a datetime widget on the current page to avoid unnecessary overhead
            const page = AppState.getCurrentPage();
            if (page && page.widgets.some(w => w.type === 'datetime')) {
                this.render();
            }
        }, 1000);
    }

    render() {
        if (!this.canvas) return;

        const page = AppState.getCurrentPage();
        const existingGrid = this.canvas.querySelector(".canvas-grid");
        const existingGuides = this.canvas.querySelectorAll(".snap-guide");

        this.canvas.innerHTML = "";
        if (existingGrid) this.canvas.appendChild(existingGrid);
        existingGuides.forEach((g) => this.canvas.appendChild(g));

        // Apply orientation/size
        const dims = AppState.getCanvasDimensions();
        this.canvas.style.width = `${dims.width}px`;
        this.canvas.style.height = `${dims.height}px`;

        // Apply dark mode/theme
        if (AppState.settings.editor_light_mode) {
            this.canvas.classList.add("light-mode");
        } else {
            this.canvas.classList.remove("light-mode");
        }

        if (!page) return;

        for (const widget of page.widgets) {
            const el = document.createElement("div");
            el.className = "widget";
            el.style.left = widget.x + "px";
            el.style.top = widget.y + "px";
            el.style.width = widget.width + "px";
            el.style.height = widget.height + "px";
            el.dataset.id = widget.id;

            if (widget.id === AppState.selectedWidgetId) {
                el.classList.add("active");
            }

            const type = (widget.type || "").toLowerCase();

            // Feature Registry Integration - use window.FeatureRegistry for global access
            const feature = window.FeatureRegistry ? window.FeatureRegistry.get(type) : null;
            if (feature && feature.render) {
                feature.render(el, widget, { getColorStyle });
                this._addResizeHandle(el);
                this.canvas.appendChild(el);
                continue;
            } else if (!window.FeatureRegistry) {
                console.error(`[Canvas] FeatureRegistry not defined on window!`);
            } else {
                // Debug: log when falling back to legacy
                console.warn(`[Canvas] No FeatureRegistry render for type '${type}', using legacy.`);
            }

            // Legacy Rendering Logic
            this._renderLegacyWidget(el, widget);

            this._addResizeHandle(el);
            this.canvas.appendChild(el);
        }
    }

    _addResizeHandle(el) {
        const handle = document.createElement("div");
        handle.className = "widget-resize-handle";

        // Make handle larger/easier to grab for lines
        // We can check if the element has specific classes or just apply general styles
        // Since this is a generic method, we might want to ensure the CSS handles it, 
        // but we can also add inline styles if needed for specific cases.
        // For now, let's rely on the CSS class but maybe ensure it's positioned well.

        el.appendChild(handle);
    }

    _renderLegacyWidget(el, widget) {
        const type = widget.type;
        const props = widget.props || {};

        // Common Styles
        el.style.opacity = (props.opacity !== undefined ? props.opacity : 100) / 100;

        if (type === "shape_rect") {
            // Migrated to features/shape_rect/render.js
        }
        else if (type === "shape_circle") {
            // Migrated to features/shape_circle/render.js
        }
        else if (type === "line") {
            // Migrated to features/line/render.js
        }

        else if (type === "datetime") {
            // Migrated to features/datetime/render.js
        }
        /*
        else {
            // Migrated to features/text/render.js
        }
        */

        else if (type === "icon") {
            // Migrated to features/icon/render.js
        }
        else if (type === "battery_icon") {
            // Migrated to features/battery_icon/render.js
        }
        else if (type === "weather_icon") {
            // Migrated to features/weather_icon/render.js
        }
        else if (type === "image") {
            // Migrated to features/image/render.js
        }
        else if (type === "online_image") {
            // Migrated to features/online_image/render.js
        }
        else if (type === "progress_bar") {
            // Migrated to features/progress_bar/render.js
        }
        else if (type === "graph") {
            // Migrated to features/graph/render.js
        }
        else {
            el.textContent = `Unknown: ${type}`;
            el.style.border = "1px solid red";
        }
    }

    setupInteractions() {
        this.canvas.addEventListener("mousedown", (ev) => {
            const widgetEl = ev.target.closest(".widget");
            if (!widgetEl) return;

            const widgetId = widgetEl.dataset.id;
            AppState.selectWidget(widgetId);

            const widget = AppState.getWidgetById(widgetId);
            if (!widget) return;

            const rect = this.canvas.getBoundingClientRect();
            const zoom = AppState.zoomLevel;
            const isResizeHandle = ev.target.classList.contains("widget-resize-handle");

            if (isResizeHandle) {
                this.dragState = {
                    mode: "resize",
                    id: widgetId,
                    startX: ev.clientX,
                    startY: ev.clientY,
                    startW: widget.width,
                    startH: widget.height
                };
            } else {
                // Calculate offset accounting for zoom
                this.dragState = {
                    mode: "move",
                    id: widgetId,
                    offsetX: (ev.clientX - rect.left) / zoom - widget.x,
                    offsetY: (ev.clientY - rect.top) / zoom - widget.y
                };
            }

            window.addEventListener("mousemove", this._onMouseMove.bind(this));
            window.addEventListener("mouseup", this._onMouseUp.bind(this));
            ev.preventDefault();
        });
    }

    setupZoomControls() {
        // Zoom buttons
        const zoomInBtn = document.getElementById("zoomInBtn");
        const zoomOutBtn = document.getElementById("zoomOutBtn");
        const zoomResetBtn = document.getElementById("zoomResetBtn");

        if (zoomInBtn) {
            zoomInBtn.addEventListener("click", () => this.zoomIn());
        }
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener("click", () => this.zoomOut());
        }
        if (zoomResetBtn) {
            zoomResetBtn.addEventListener("click", () => this.zoomReset());
        }

        // Mouse wheel zoom on canvas container
        if (this.canvasContainer) {
            this.canvasContainer.addEventListener("wheel", (ev) => {
                if (ev.ctrlKey) {
                    ev.preventDefault();
                    const delta = ev.deltaY > 0 ? -0.1 : 0.1;
                    const newZoom = AppState.zoomLevel + delta;
                    AppState.setZoomLevel(newZoom);
                }
            }, { passive: false });
        }

        // Keyboard shortcuts for zoom
        document.addEventListener("keydown", (ev) => {
            if (ev.ctrlKey && (ev.key === "+" || ev.key === "=")) {
                ev.preventDefault();
                this.zoomIn();
            } else if (ev.ctrlKey && ev.key === "-") {
                ev.preventDefault();
                this.zoomOut();
            } else if (ev.ctrlKey && ev.key === "0") {
                ev.preventDefault();
                this.zoomReset();
            }
        });
    }

    zoomIn() {
        AppState.setZoomLevel(AppState.zoomLevel + 0.1);
    }

    zoomOut() {
        AppState.setZoomLevel(AppState.zoomLevel - 0.1);
    }

    zoomReset() {
        AppState.setZoomLevel(1.0);
        // Center the canvas in the container
        if (this.canvasContainer) {
            this.canvasContainer.scrollTo({
                left: (this.canvasContainer.scrollWidth - this.canvasContainer.clientWidth) / 2,
                top: (this.canvasContainer.scrollHeight - this.canvasContainer.clientHeight) / 2,
                behavior: "smooth"
            });
        }
    }

    applyZoom() {
        const zoom = AppState.zoomLevel;
        if (this.canvas) {
            this.canvas.style.transform = `scale(${zoom})`;
        }
        // Update zoom level display
        const zoomLevelEl = document.getElementById("zoomLevel");
        if (zoomLevelEl) {
            zoomLevelEl.textContent = Math.round(zoom * 100) + "%";
        }
    }

    _onMouseMove(ev) {
        if (!this.dragState) return;

        const widget = AppState.getWidgetById(this.dragState.id);
        if (!widget) return;

        // Ensure grid is visible during drag
        if (!this.canvas.querySelector(".canvas-grid")) {
            const grid = document.createElement("div");
            grid.className = "canvas-grid";
            this.canvas.insertBefore(grid, this.canvas.firstChild);
        }

        const dims = AppState.getCanvasDimensions();
        const zoom = AppState.zoomLevel;

        if (this.dragState.mode === "move") {
            const rect = this.canvas.getBoundingClientRect();
            // Account for zoom when calculating position
            let x = (ev.clientX - rect.left) / zoom - this.dragState.offsetX;
            let y = (ev.clientY - rect.top) / zoom - this.dragState.offsetY;

            x = Math.max(0, Math.min(dims.width - widget.width, x));
            y = Math.max(0, Math.min(dims.height - widget.height, y));

            const snapped = this.applySnapToPosition(widget, x, y, ev.altKey, dims);
            widget.x = snapped.x;
            widget.y = snapped.y;
        } else if (this.dragState.mode === "resize") {
            // Account for zoom when calculating resize delta
            let w = this.dragState.startW + (ev.clientX - this.dragState.startX) / zoom;
            let h = this.dragState.startH + (ev.clientY - this.dragState.startY) / zoom;

            const wtype = (widget.type || "").toLowerCase();

            // Special handling for line widgets - allow resizing along the line direction
            if (wtype === "line") {
                const props = widget.props || {};
                const orientation = props.orientation || "horizontal";
                const strokeWidth = parseInt(props.stroke_width || 3, 10);

                if (orientation === "vertical") {
                    // Vertical line: height is the length (resizable), width stays as stroke_width
                    w = strokeWidth;
                } else {
                    // Horizontal line: width is the length (resizable), height stays as stroke_width
                    h = strokeWidth;
                }
            }

            // Clamp to canvas bounds
            const minSize = 1;
            w = Math.max(minSize, Math.min(dims.width - widget.x, w));
            h = Math.max(minSize, Math.min(dims.height - widget.y, h));
            widget.width = Math.round(w);
            widget.height = Math.round(h);

            // Special handling for icons
            if (wtype === "icon" || wtype === "weather_icon" || wtype === "battery_icon") {
                const props = widget.props || {};
                if (props.fit_icon_to_frame) {
                    const padding = 4;
                    const maxDim = Math.max(8, Math.min(widget.width - padding * 2, widget.height - padding * 2));
                    props.size = Math.round(maxDim);
                } else {
                    const newSize = Math.max(8, Math.min(widget.width, widget.height));
                    props.size = Math.round(newSize);
                }
            } else if (wtype === "shape_circle") {
                const size = Math.max(widget.width, widget.height);
                widget.width = size;
                widget.height = size;
            }
        }

        this.render();
    }

    _onMouseUp() {
        if (this.dragState) {
            this.dragState = null;
            this.clearSnapGuides();
            window.removeEventListener("mousemove", this._onMouseMove.bind(this));
            window.removeEventListener("mouseup", this._onMouseUp.bind(this));

            // Trigger state update to save history
            AppState.recordHistory();
            emit(EVENTS.STATE_CHANGED);
            this.render();
        }
    }

    // --- Snapping ---

    clearSnapGuides() {
        const guides = this.canvas.querySelectorAll(".snap-guide");
        guides.forEach((g) => g.remove());
    }

    addSnapGuideVertical(x) {
        const guide = document.createElement("div");
        guide.className = "snap-guide snap-guide-vertical";
        guide.style.left = `${x}px`;
        this.canvas.appendChild(guide);
    }

    addSnapGuideHorizontal(y) {
        const guide = document.createElement("div");
        guide.className = "snap-guide snap-guide-horizontal";
        guide.style.top = `${y}px`;
        this.canvas.appendChild(guide);
    }

    getSnapLines(excludeWidgetId, dims) {
        const page = AppState.getCurrentPage();
        const vertical = [];
        const horizontal = [];

        vertical.push(0, dims.width / 2, dims.width);
        horizontal.push(0, dims.height / 2, dims.height);

        if (page && Array.isArray(page.widgets)) {
            for (const w of page.widgets) {
                if (!w || w.id === excludeWidgetId) continue;
                const left = w.x;
                const right = w.x + (w.width || 0);
                const top = w.y;
                const bottom = w.y + (w.height || 0);
                const cx = left + (w.width || 0) / 2;
                const cy = top + (w.height || 0) / 2;
                vertical.push(left, cx, right);
                horizontal.push(top, cy, bottom);
            }
        }

        return { vertical, horizontal };
    }

    applySnapToPosition(widget, x, y, altKey, dims) {
        if (!AppState.snapEnabled || altKey) {
            this.clearSnapGuides();
            return { x: Math.round(x), y: Math.round(y) };
        }

        const snapLines = this.getSnapLines(widget.id, dims);
        const w = widget.width || 0;
        const h = widget.height || 0;

        let snappedX = x;
        let snappedY = y;
        let snappedV = null;
        let snappedH = null;

        // Vertical Snap
        const vCandidates = [
            { val: x, apply: (line) => (snappedX = line) },
            { val: x + w / 2, apply: (line) => (snappedX = line - w / 2) },
            { val: x + w, apply: (line) => (snappedX = line - w) }
        ];

        let bestDeltaV = SNAP_DISTANCE + 1;
        for (const cand of vCandidates) {
            for (const line of snapLines.vertical) {
                const delta = Math.abs(cand.val - line);
                if (delta <= SNAP_DISTANCE && delta < bestDeltaV) {
                    bestDeltaV = delta;
                    snappedV = line;
                    cand.apply(line);
                }
            }
        }

        // Horizontal Snap
        const hCandidates = [
            { val: y, apply: (line) => (snappedY = line) },
            { val: y + h / 2, apply: (line) => (snappedY = line - h / 2) },
            { val: y + h, apply: (line) => (snappedY = line - h) }
        ];

        let bestDeltaH = SNAP_DISTANCE + 1;
        for (const cand of hCandidates) {
            for (const line of snapLines.horizontal) {
                const delta = Math.abs(cand.val - line);
                if (delta <= SNAP_DISTANCE && delta < bestDeltaH) {
                    bestDeltaH = delta;
                    snappedH = line;
                    cand.apply(line);
                }
            }
        }

        snappedX = Math.max(0, Math.min(dims.width - w, snappedX));
        snappedY = Math.max(0, Math.min(dims.height - h, snappedY));

        this.clearSnapGuides();
        if (snappedV != null) this.addSnapGuideVertical(snappedV);
        if (snappedH != null) this.addSnapGuideHorizontal(snappedH);

        return {
            x: Math.round(snappedX),
            y: Math.round(snappedY)
        };
    }
}
