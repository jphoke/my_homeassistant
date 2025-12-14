/**
 * Parses an ESPHome YAML snippet offline to extract the layout.
 * @param {string} yamlText - The YAML string to parse.
 * @returns {Object} The parsed layout object containing pages and settings.
 */
function parseSnippetYamlOffline(yamlText) {
    const lines = yamlText.split(/\r?\n/);
    const lambdaLines = [];
    let inLambda = false;
    let lambdaIndent = 0;

    for (const rawLine of lines) {
        const line = rawLine.replace(/\t/g, "    ");

        if (!inLambda && line.match(/^\s*lambda:\s*\|\-/)) {
            inLambda = true;
            continue;
        }

        if (inLambda) {
            if (!line.trim()) {
                lambdaLines.push("");
                continue;
            }

            const indentMatch = line.match(/^(\s+)/);
            if (!indentMatch) {
                inLambda = false;
                continue;
            }

            const indentLen = indentMatch[1].length;
            if (lambdaIndent === 0) {
                lambdaIndent = indentLen;
            }

            if (indentLen < lambdaIndent) {
                inLambda = false;
                continue;
            }

            const stripped = line.slice(lambdaIndent);
            lambdaLines.push(stripped);
        }
    }

    while (lines.length && lines[0].match(/^\s*#\s*Local preview snippet/)) {
        lines.shift();
    }
    while (lines.length && lines[lines.length - 1].match(/^\s*#\s*Backend unreachable/)) {
        lines.pop();
    }

    const pageMap = new Map();
    const intervalMap = new Map();
    const nameMap = new Map();
    let currentPageIndex = null;

    for (const line of lambdaLines) {
        const pageMatch = line.match(/if\s*\(\s*(?:id\s*\(\s*display_page\s*\)|page)\s*==\s*(\d+)\s*\)/);
        if (pageMatch) {
            currentPageIndex = parseInt(pageMatch[1], 10);
            if (!pageMap.has(currentPageIndex)) {
                pageMap.set(currentPageIndex, []);
            }
        }

        const intervalMatch = line.match(/case\s+(\d+):\s*interval\s*=\s*(\d+);/);
        if (intervalMatch) {
            const idx = parseInt(intervalMatch[1], 10);
            const val = parseInt(intervalMatch[2], 10);
            intervalMap.set(idx, val);
            // Ensure page exists in map even if no widgets yet
            if (!pageMap.has(idx)) {
                pageMap.set(idx, []);
            }
        }

        const nameMatch = line.match(/\/\/\s*page:name\s+"(.+)"/);
        if (nameMatch && currentPageIndex !== null) {
            nameMap.set(currentPageIndex, nameMatch[1]);
        }
    }

    if (pageMap.size === 0) {
        pageMap.set(0, []);
    }

    const layout = {
        settings: {
            orientation: "landscape",
            dark_mode: false
        },
        pages: Array.from(pageMap.entries()).sort((a, b) => a[0] - b[0]).map(([idx, _]) => ({
            id: `page_${idx}`,
            name: nameMap.has(idx) ? nameMap.get(idx) : `Page ${idx + 1}`,
            refresh_s: intervalMap.has(idx) ? intervalMap.get(idx) : null,
            widgets: []
        }))
    };

    currentPageIndex = 0;

    function getCurrentPageWidgets() {
        const page = layout.pages.find((p, idx) => idx === currentPageIndex);
        return page ? page.widgets : layout.pages[0].widgets;
    }

    function parseWidgetMarker(comment) {
        const match = comment.match(/^\/\/\s*widget:(\w+)\s+(.+)$/);
        if (!match) return null;

        const widgetType = match[1];
        const propsStr = match[2];
        const props = {};

        // Improved regex to handle:
        // 1. Quoted strings: key:"value with spaces"
        // 2. Unquoted values: key:value
        // 3. Unquoted values at the end of string: key:value with spaces
        const regex = /(\w+):(?:"([^"]*)"|([^:]*?)(?=\s+\w+:|$))/g;
        let m;
        while ((m = regex.exec(propsStr)) !== null) {
            let value = m[2] !== undefined ? m[2] : m[3];
            if (value) {
                value = value.trim();
            }
            props[m[1]] = value;
        }

        return { widgetType, props };
    }

    let skipRendering = false;

    for (const cmd of lambdaLines) {
        const trimmed = cmd.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const pageMatch = trimmed.match(/if\s*\(\s*(?:id\s*\(\s*display_page\s*\)|page)\s*==\s*(\d+)\s*\)/);
        if (pageMatch) {
            currentPageIndex = parseInt(pageMatch[1], 10);
            continue;
        }

        const widgets = getCurrentPageWidgets();

        if (skipRendering) {
            if (trimmed === "}" || trimmed === "}}" || trimmed.startsWith("//") || !trimmed.match(/^it\./)) {
                skipRendering = false;
            }
            if (trimmed.match(/^it\./)) {
                continue;
            }
        }

        if (trimmed.startsWith("//")) {
            const marker = parseWidgetMarker(trimmed);
            if (marker && marker.props.id && marker.props.type) {
                const p = marker.props;
                const widget = {
                    id: p.id,
                    type: p.type,
                    x: parseInt(p.x || 0, 10),
                    y: parseInt(p.y || 0, 10),
                    width: parseInt(p.w || 100, 10),
                    height: parseInt(p.h || 30, 10),
                    title: p.title || "",
                    entity_id: p.entity || p.ent || "",
                    condition_entity: p.cond_ent || "",
                    condition_operator: p.cond_op || "",
                    condition_state: p.cond_state || "",
                    condition_min: p.cond_min || "",
                    condition_max: p.cond_max || "",
                    props: {}
                };

                if (p.type === "icon") {
                    widget.props = {
                        code: p.code || "F0595",
                        size: parseInt(p.size || 48, 10),
                        color: p.color || "black",
                        fit_icon_to_frame: (p.fit === "true" || p.fit === "1")
                    };
                } else if (p.type === "text" || p.type === "label") {
                    widget.props = {
                        text: p.text || "",
                        font_size: parseInt(p.font_size || p.size || 20, 10),
                        font_family: p.font_family || p.font || "Roboto",
                        font_weight: parseInt(p.font_weight || p.weight || 400, 10),
                        italic: (p.italic === "true" || p.italic === true),
                        bpp: parseInt(p.bpp || 1, 10),
                        color: p.color || "black",
                        text_align: p.align || p.text_align || "TOP_LEFT"
                    };
                } else if (p.type === "sensor_text") {
                    widget.props = {
                        label_font_size: parseInt(p.label_font || p.label_font_size || 14, 10),
                        value_font_size: parseInt(p.value_font || p.value_font_size || 20, 10),
                        value_format: p.format || "label_value",
                        color: p.color || "black",
                        italic: (p.italic === "true" || p.italic === true || p.font_style === "italic"),
                        font_family: p.font_family || "Roboto",
                        font_weight: parseInt(p.font_weight || 400, 10),
                        unit: p.unit || "",
                        precision: parseInt(p.precision || -1, 10),
                        text_align: p.align || p.text_align || "TOP_LEFT",
                        label_align: p.label_align || p.align || p.text_align || "TOP_LEFT",
                        value_align: p.value_align || p.align || p.text_align || "TOP_LEFT",
                        is_local_sensor: (p.local === "true")
                    };
                } else if (p.type === "datetime") {
                    widget.props = {
                        format: p.format || "time_date",
                        time_font_size: parseInt(p.time_font || 28, 10),
                        date_font_size: parseInt(p.date_font || 16, 10),
                        color: p.color || "black",
                        italic: (p.italic === "true" || p.italic === true || p.font_style === "italic"),
                        font_family: p.font_family || "Roboto"
                    };
                } else if (p.type === "progress_bar") {
                    widget.props = {
                        show_label: (p.show_label !== "false"),
                        show_percentage: (p.show_pct !== "false"),
                        bar_height: parseInt(p.bar_h || p.bar_height || 15, 10),
                        border_width: parseInt(p.border_w || p.border || 1, 10),
                        color: p.color || "black",
                        is_local_sensor: (p.local === "true")
                    };
                } else if (p.type === "battery_icon") {
                    widget.props = {
                        size: parseInt(p.size || 32, 10),
                        font_size: parseInt(p.font_size || 12, 10),
                        color: p.color || "black",
                        is_local_sensor: (p.local === "true")
                    };
                } else if (p.type === "weather_icon") {
                    widget.props = {
                        size: parseInt(p.size || 48, 10),
                        color: p.color || "black"
                    };
                } else if (p.type === "qr_code") {
                    widget.props = {
                        value: p.value || "https://esphome.io",
                        scale: parseInt(p.scale || 2, 10),
                        ecc: p.ecc || "LOW",
                        color: p.color || "black"
                    };
                } else if (p.type === "image") {
                    widget.props = {
                        path: (p.path || "").replace(/^"|"$/g, ''),
                        invert: (p.invert === "true" || p.invert === "1"),
                        dither: p.dither || "FLOYDSTEINBERG",
                        transparency: p.transparency || "",
                        image_type: p.img_type || "BINARY",
                        render_mode: p.render_mode || "Auto"
                    };
                } else if (p.type === "online_image") {
                    widget.props = {
                        url: p.url || "",
                        invert: (p.invert === "true" || p.invert === "1"),
                        interval_s: parseInt(p.interval || 300, 10),
                        render_mode: p.render_mode || "Auto"
                    };
                } else if (p.type === "puppet") {
                    widget.props = {
                        image_url: p.url || "",
                        invert: (p.invert === "true" || p.invert === "1"),
                        image_type: p.img_type || "RGB565",
                        transparency: p.transparency || "opaque",
                        render_mode: p.render_mode || "Auto"
                    };
                } else if (p.type === "shape_rect") {
                    widget.props = {
                        fill: (p.fill === "true" || p.fill === "1"),
                        border_width: parseInt(p.border || 1, 10),
                        color: p.color || "black",
                        opacity: parseInt(p.opacity || 100, 10)
                    };
                } else if (p.type === "rounded_rect") {
                    widget.props = {
                        fill: (p.fill === "true" || p.fill === "1"),
                        // Robustly parse show_border, defaulting to true if not explicitly false
                        show_border: (p.show_border !== "false" && p.show_border !== "0"),
                        border_width: parseInt(p.border || 4, 10),
                        radius: parseInt(p.radius || 10, 10),
                        color: p.color || "black",
                        opacity: parseInt(p.opacity || 100, 10)
                    };
                } else if (p.type === "shape_circle") {
                    widget.props = {
                        fill: (p.fill === "true" || p.fill === "1"),
                        border_width: parseInt(p.border || 1, 10),
                        color: p.color || "black",
                        opacity: parseInt(p.opacity || 100, 10)
                    };
                } else if (p.type === "line") {
                    widget.props = {
                        stroke_width: parseInt(p.stroke || 3, 10),
                        color: p.color || "black",
                        orientation: p.orientation || "horizontal"
                    };
                } else if (p.type === "graph") {
                    widget.entity_id = p.entity || "";
                    widget.props = {
                        duration: p.duration || "1h",
                        border: (p.border === "true" || p.border === "1" || p.border == null),
                        grid: (p.grid === "true" || p.grid === "1" || p.grid == null),
                        color: p.color || "black",
                        x_grid: p.x_grid || "",
                        y_grid: p.y_grid || "",
                        line_thickness: parseInt(p.line_thickness || 3, 10),
                        line_type: p.line_type || "SOLID",
                        continuous: (p.continuous !== "false" && p.continuous !== "0"),
                        min_value: p.min_value || "",
                        max_value: p.max_value || "",
                        min_range: p.min_range || "",
                        max_range: p.max_range || "",
                        is_local_sensor: (p.local === "true")
                    };
                } else if (p.type === "quote_rss") {
                    widget.props = {
                        feed_url: p.feed_url || "https://www.brainyquote.com/link/quotebr.rss",
                        show_author: (p.show_author !== "false"),
                        random: (p.random !== "false"),
                        refresh_interval: p.refresh_interval || p.refresh || "24h",
                        quote_font_size: parseInt(p.quote_font_size || p.quote_font || 18, 10),
                        author_font_size: parseInt(p.author_font_size || p.author_font || 14, 10),
                        font_family: p.font_family || p.font || "Roboto",
                        font_weight: parseInt(p.font_weight || p.weight || 400, 10),
                        color: p.color || "black",
                        text_align: p.align || p.text_align || "TOP_LEFT",
                        word_wrap: (p.word_wrap !== "false" && p.wrap !== "false"),
                        italic_quote: (p.italic_quote !== "false")
                    };
                }

                widgets.push(widget);
                skipRendering = true;
                continue;
            }
            continue;
        }

        let m;

        m = trimmed.match(/^it\.rectangle\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*COLOR_OFF)?\s*\)\s*;?/);
        if (m) {
            widgets.push({
                id: "w_rect_" + widgets.length,
                type: "shape_rect",
                x: parseInt(m[1], 10),
                y: parseInt(m[2], 10),
                width: parseInt(m[3], 10),
                height: parseInt(m[4], 10),
                title: "",
                entity_id: "",
                props: {
                    fill: false,
                    border_width: 1,
                    color: "black",
                    opacity: 100
                }
            });
            continue;
        }

        m = trimmed.match(/^it\.filled_rectangle\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*COLOR_OFF)?\s*\)\s*;?/);
        if (m) {
            widgets.push({
                id: "w_frect_" + widgets.length,
                type: "shape_rect",
                x: parseInt(m[1], 10),
                y: parseInt(m[2], 10),
                width: parseInt(m[3], 10),
                height: parseInt(m[4], 10),
                title: "",
                entity_id: "",
                props: {
                    fill: true,
                    border_width: 1,
                    color: "black",
                    opacity: 100
                }
            });
            continue;
        }

        m = trimmed.match(/^it\.circle\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*COLOR_OFF)?\s*\)\s*;?/);
        if (m) {
            const r = parseInt(m[3], 10);
            widgets.push({
                id: "w_circle_" + widgets.length,
                type: "shape_circle",
                x: parseInt(m[1], 10) - r,
                y: parseInt(m[2], 10) - r,
                width: r * 2,
                height: r * 2,
                title: "",
                entity_id: "",
                props: {
                    fill: false,
                    border_width: 1,
                    color: "black",
                    opacity: 100
                }
            });
            continue;
        }

        m = trimmed.match(/^it\.filled_circle\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*COLOR_OFF)?\s*\)\s*;?/);
        if (m) {
            const r = parseInt(m[3], 10);
            widgets.push({
                id: "w_fcircle_" + widgets.length,
                type: "shape_circle",
                x: parseInt(m[1], 10) - r,
                y: parseInt(m[2], 10) - r,
                width: r * 2,
                height: r * 2,
                title: "",
                entity_id: "",
                props: {
                    fill: true,
                    border_width: 1,
                    color: "black",
                    opacity: 100
                }
            });
            continue;
        }

        m = trimmed.match(/^it\.line\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*;?/);
        if (m) {
            const x1 = parseInt(m[1], 10);
            const y1 = parseInt(m[2], 10);
            const x2 = parseInt(m[3], 10);
            const y2 = parseInt(m[4], 10);
            widgets.push({
                id: "w_line_" + widgets.length,
                type: "line",
                x: x1,
                y: y1,
                width: x2 - x1,
                height: y2 - y1,
                title: "",
                entity_id: "",
                props: {
                    stroke_width: 1,
                    color: "black",
                    orientation: (Math.abs(y2 - y1) > Math.abs(x2 - x1)) ? "vertical" : "horizontal"
                }
            });
            continue;
        }
    }

    return layout;
}

/**
 * Loads a parsed layout into the application state.
 * @param {Object} layout - The parsed layout object.
 */
function loadLayoutIntoState(layout) {
    if (!layout || !Array.isArray(layout.pages)) {
        console.error("Invalid layout - missing pages array");
        throw new Error("invalid_layout");
    }

    const pages = layout.pages.map((p, idx) => ({
        ...p,  // Preserve all properties from imported page
        id: p.id || `page_${idx}`,
        name: p.name || `Page ${idx + 1}`,
        widgets: Array.isArray(p.widgets) ? p.widgets : []
    }));

    if (!pages.length) {
        console.warn("No pages, creating default empty page");
        pages.push({
            id: "page_0",
            name: "Imported",
            widgets: []
        });
    }

    // Set current layout ID from the layout data
    // Only update if the layout has a device_id - don't reset an existing valid ID
    if (layout.device_id) {
        const currentId = AppState.currentLayoutId;
        if (currentId !== layout.device_id) {
            console.log(`[loadLayoutIntoState] Updating currentLayoutId: ${currentId} -> ${layout.device_id}`);
            AppState.setCurrentLayoutId(layout.device_id);
        }
    } else {
        console.log(`[loadLayoutIntoState] No device_id in layout, keeping currentLayoutId: ${AppState.currentLayoutId}`);
    }

    // Set device name from layout
    if (layout.name) {
        AppState.setDeviceName(layout.name);
    }

    // Set device model from layout (check multiple possible locations)
    const deviceModel = layout.device_model || layout.settings?.device_model;
    if (deviceModel) {
        AppState.setDeviceModel(deviceModel);
        window.currentDeviceModel = deviceModel; // Keep global in sync
    }

    // Merge imported settings with existing settings
    const currentSettings = AppState.getSettings();
    const newSettings = { ...currentSettings, ...(layout.settings || {}) };

    // Ensure device_name is in settings too (for Device Settings modal)
    if (layout.name) {
        newSettings.device_name = layout.name;
    }

    // Ensure device_model is in settings too
    if (deviceModel) {
        newSettings.device_model = deviceModel;
    }

    // Ensure defaults for new settings
    if (newSettings.sleep_enabled === undefined) newSettings.sleep_enabled = false;
    if (newSettings.sleep_start_hour === undefined) newSettings.sleep_start_hour = 0;
    if (newSettings.sleep_end_hour === undefined) newSettings.sleep_end_hour = 5;
    if (newSettings.manual_refresh_only === undefined) newSettings.manual_refresh_only = false;
    if (newSettings.deep_sleep_enabled === undefined) newSettings.deep_sleep_enabled = false;
    if (newSettings.deep_sleep_interval === undefined) newSettings.deep_sleep_interval = 600;

    // Update State
    AppState.setPages(pages);
    AppState.setSettings(newSettings);
    // Preserve current page index if valid, otherwise reset to 0
    const currentIndex = AppState.currentPageIndex;
    if (currentIndex >= 0 && currentIndex < pages.length) {
        AppState.setCurrentPageIndex(currentIndex);
    } else {
        AppState.setCurrentPageIndex(0);
    }

    // Note: AppState emits EVENTS.STATE_CHANGED and EVENTS.PAGE_CHANGED,
    // which should trigger UI updates in Sidebar, Canvas, and PropertiesPanel.
    // The legacy editor.js has a sync mechanism that listens for these events
    // to update its own 'pages' array for renderCanvas() compatibility.
}
