// --- Environment detection: HA backend vs standalone/offline ---
function detectHaBackendBaseUrl() {
    try {
        const loc = window.location;
        if (loc.protocol === "file:") {
            return null;
        }
        if (
            loc.hostname === "homeassistant" ||
            loc.hostname === "hassio" ||
            loc.pathname.includes("/api/") ||
            loc.pathname.includes("/local/") ||
            loc.pathname.includes("/hacsfiles/") ||
            loc.pathname.includes("/reterminal-dashboard")
        ) {
            return `${loc.origin}/api/reterminal_dashboard`;
        }
        return null;
    } catch (e) {
        return null;
    }
}

const HA_API_BASE = detectHaBackendBaseUrl();

function hasHaBackend() {
    return !!HA_API_BASE;
}

// --- HA Entity States Cache for Live Preview ---
let entityStatesCache = {};
let entityStatesFetchInProgress = false;

async function fetchEntityStates() {
    if (!hasHaBackend()) {
        console.log("[EntityStates] No HA backend detected");
        return;
    }
    if (entityStatesFetchInProgress) return;

    entityStatesFetchInProgress = true;
    try {
        console.log("[EntityStates] Fetching from:", `${HA_API_BASE}/entities`);
        const resp = await fetch(`${HA_API_BASE}/entities?domains=sensor,binary_sensor,weather`);
        if (!resp.ok) {
            console.warn("[EntityStates] Failed to fetch:", resp.status);
            return;
        }
        const entities = await resp.json();
        if (!Array.isArray(entities)) {
            console.warn("[EntityStates] Invalid response format");
            return;
        }

        console.log(`[EntityStates] Received ${entities.length} entities`);

        const newCache = {};
        for (const entity of entities) {
            if (entity.entity_id && entity.state !== undefined) {
                const formatted = entity.unit ? `${entity.state} ${entity.unit}` : entity.state;
                newCache[entity.entity_id] = {
                    state: entity.state,
                    unit: entity.unit,
                    attributes: entity.attributes || {},
                    formatted: formatted
                };
            }
        }
        entityStatesCache = newCache;
        console.log(`[EntityStates] Cached ${Object.keys(newCache).length} entity states`);

        if (typeof renderCanvas === 'function') {
            renderCanvas();
        }
    } catch (err) {
        console.warn("[EntityStates] Error fetching:", err);
    } finally {
        entityStatesFetchInProgress = false;
    }
}

function getEntityState(entityId) {
    const entry = entityStatesCache[entityId];
    return entry ? entry.formatted : null;
}

function getEntityAttributes(entityId) {
    const entry = entityStatesCache[entityId];
    return entry ? entry.attributes : null;
}

async function loadHaEntitiesIfNeeded() {
    if (hasHaBackend()) {
        return fetchEntityStates();
    }
}

if (hasHaBackend()) {
    fetchEntityStates();
    setInterval(fetchEntityStates, 30000);
}

function setImportError(message) {
    const importSnippetError = document.getElementById("importSnippetError");
    if (importSnippetError) {
        importSnippetError.textContent = message || "";
    }
}

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
    let currentPageIndex = null;

    for (const line of lambdaLines) {
        const pageMatch = line.match(/if\s*\(\s*(?:id\s*\(\s*display_page\s*\)|page)\s*==\s*(\d+)\s*\)/);
        if (pageMatch) {
            currentPageIndex = parseInt(pageMatch[1], 10);
            if (!pageMap.has(currentPageIndex)) {
                pageMap.set(currentPageIndex, []);
            }
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
            name: `Page ${idx + 1}`,
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

        const regex = /(\w+):((?:"[^"]*")|(?:[^\s]+))/g;
        let m;
        while ((m = regex.exec(propsStr)) !== null) {
            let value = m[2];
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
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
                        text_align: p.align || "TOP_LEFT"
                    };
                } else if (p.type === "sensor_text") {
                    widget.props = {
                        label_font_size: parseInt(p.label_font || 14, 10),
                        value_font_size: parseInt(p.value_font || 20, 10),
                        value_format: p.format || "label_value",
                        color: p.color || "black",
                        font_style: p.font_style || "regular",
                        font_family: p.font_family || "Roboto",
                        font_weight: parseInt(p.font_weight || 400, 10),
                        unit: p.unit || "",
                        precision: parseInt(p.precision || -1, 10),
                        text_align: p.align || "TOP_LEFT"
                    };
                } else if (p.type === "datetime") {
                    widget.props = {
                        format: p.format || "time_date",
                        time_font_size: parseInt(p.time_font || 28, 10),
                        date_font_size: parseInt(p.date_font || 16, 10),
                        color: p.color || "black",
                        font_style: p.font_style || "regular"
                    };
                } else if (p.type === "progress_bar") {
                    widget.props = {
                        show_label: (p.show_label !== "false"),
                        show_percentage: (p.show_pct !== "false"),
                        bar_height: parseInt(p.bar_h || p.bar_height || 15, 10),
                        border_width: parseInt(p.border_w || p.border || 1, 10),
                        color: p.color || "black"
                    };
                } else if (p.type === "battery_icon") {
                    widget.props = {
                        size: parseInt(p.size || 32, 10),
                        color: p.color || "black"
                    };
                } else if (p.type === "weather_icon") {
                    widget.props = {
                        size: parseInt(p.size || 48, 10),
                        color: p.color || "black"
                    };
                } else if (p.type === "image") {
                    widget.props = {
                        path: p.path || "",
                        invert: (p.invert === "true" || p.invert === "1"),
                        dither: p.dither || "FLOYDSTEINBERG",
                        transparency: p.transparency || "",
                        image_type: p.img_type || "BINARY"
                    };
                } else if (p.type === "online_image") {
                    widget.props = {
                        url: p.url || "",
                        invert: (p.invert === "true" || p.invert === "1"),
                        interval_s: parseInt(p.interval || 300, 10)
                    };
                } else if (p.type === "puppet") {
                    widget.props = {
                        image_url: p.url || "",
                        image_type: p.img_type || "RGB565",
                        transparency: p.transparency || "opaque"
                    };
                } else if (p.type === "shape_rect") {
                    widget.props = {
                        fill: (p.fill === "true" || p.fill === "1"),
                        border_width: parseInt(p.border || 1, 10),
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
                        stroke_width: parseInt(p.stroke || 1, 10),
                        color: p.color || "black"
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
                        max_range: p.max_range || ""
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
                    color: "black"
                }
            });
            continue;
        }
    }

    return layout;
}

function applyImportedLayout(layout) {
    console.log("=== applyImportedLayout called ===");
    console.log("Layout:", JSON.stringify(layout, null, 2));

    if (!layout || !Array.isArray(layout.pages)) {
        console.error("Invalid layout - missing pages array");
        throw new Error("invalid_layout");
    }

    console.log("Pages before mapping:", layout.pages.length);
    layout.pages.forEach((p, i) => {
        console.log(`Page ${i}: ${p.widgets ? p.widgets.length : 0} widgets`);
    });

    pages = layout.pages.map((p, idx) => ({
        id: p.id || `page_${idx}`,
        name: p.name || `Page ${idx + 1}`,
        widgets: Array.isArray(p.widgets) ? p.widgets : []
    }));

    console.log("Pages after mapping:", pages.length);
    pages.forEach((p, i) => {
        console.log(`Mapped page ${i}: ${p.widgets.length} widgets`, p.widgets.map(w => w.id));
    });

    if (!pages.length) {
        console.warn("No pages, creating default empty page");
        pages = [
            {
                id: "page_0",
                name: "Imported",
                widgets: []
            }
        ];
    }
    settings = layout.settings || settings || {};
    deviceName = layout.name || "reTerminal E1001";
    // Ensure defaults for new settings
    if (settings.sleep_enabled === undefined) settings.sleep_enabled = false;
    if (settings.sleep_start_hour === undefined) settings.sleep_start_hour = 0;
    if (settings.sleep_end_hour === undefined) settings.sleep_end_hour = 5;

    // Preserve current page index if possible, otherwise reset to 0
    if (currentPageIndex >= pages.length) {
        currentPageIndex = 0;
    }
    rebuildWidgetsIndex();
    applyOrientation(settings.orientation || "landscape");
    renderPagesSidebar();
    renderCanvas();
    renderPropertiesPanel();
    console.log("=== applyImportedLayout completed ===");
}

async function handleImportSnippetConfirm() {
    setImportError("");
    const textarea = document.getElementById("importSnippetTextarea");
    if (!textarea) return;
    const yaml = textarea.value || "";
    if (!yaml.trim()) {
        setImportError("Please paste an ESPHome YAML snippet first.");
        return;
    }

    if (hasHaBackend()) {
        try {
            const resp = await fetch(`${HA_API_BASE}/import_snippet`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ yaml })
            });

            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}));
                const msg =
                    data.message ||
                    data.error ||
                    `Home Assistant import_snippet failed with status ${resp.status}`;
                setImportError(msg);
                return;
            }

            const result = await resp.json();
            applyImportedLayout(result);
            closeImportSnippetModal();
            sidebarStatus.innerHTML =
                '<span>Imported layout from snippet via Home Assistant backend.</span>';
            return;
        } catch (err) {
            console.warn("HA import_snippet request failed; falling back to offline parser.", err);
        }
    }

    try {
        const offlineLayout = parseSnippetYamlOffline(yaml);
        applyImportedLayout(offlineLayout);
        closeImportSnippetModal();
        sidebarStatus.innerHTML =
            '<span>Imported layout from snippet (offline client-side parser).</span>';
    } catch (err) {
        console.error("Offline snippet import failed", err);
        setImportError(
            "Could not parse snippet offline. Try importing within Home Assistant for full support."
        );
    }
}

function openImportSnippetModal() {
    const modal = document.getElementById("importSnippetModal");
    const textarea = document.getElementById("importSnippetTextarea");
    setImportError("");
    if (textarea) {
        textarea.value = "";
    }
    if (modal) {
        modal.classList.remove("hidden");
    }
}

function closeImportSnippetModal() {
    const modal = document.getElementById("importSnippetModal");
    if (modal) {
        modal.classList.add("hidden");
    }
}

const canvas = document.getElementById("canvas");
const pageListEl = document.getElementById("pageList");
const currentPageNameEl = document.getElementById("currentPageName");
const propertiesPanel = document.getElementById("propertiesPanel");
const sidebarStatus = document.getElementById("sidebarStatus");
const snippetBox = document.getElementById("snippetBox");

const addPageBtn = document.getElementById("addPageBtn");
const saveLayoutBtn = document.getElementById("saveLayoutBtn");
const generateSnippetBtn = document.getElementById("generateSnippetBtn");
const copySnippetBtn = document.getElementById("copySnippetBtn");
const fullscreenSnippetBtn = document.getElementById("fullscreenSnippetBtn");
const updateLayoutBtn = document.getElementById("updateLayoutBtn");

const snippetFullscreenModal = document.getElementById("snippetFullscreenModal");
const snippetFullscreenContent = document.getElementById("snippetFullscreenContent");
const snippetFullscreenClose = document.getElementById("snippetFullscreenClose");

const importSnippetModal = document.getElementById("importSnippetModal");
const importSnippetTextarea = document.getElementById("importSnippetTextarea");
const importSnippetError = document.getElementById("importSnippetError");
const importSnippetCancel = document.getElementById("importSnippetCancel");
const importSnippetConfirm = document.getElementById("importSnippetConfirm");

// --- Device Settings Modal ---
const deviceSettingsModal = document.getElementById('deviceSettingsModal');
const deviceSettingsClose = document.getElementById('deviceSettingsClose');
const deviceSettingsSave = document.getElementById('deviceSettingsSave');

// Inputs
const deviceNameInput = document.getElementById('deviceName');
const deviceOrientationInput = document.getElementById('deviceOrientation');
const deviceDarkModeInput = document.getElementById('deviceDarkMode');

const settingSleepEnabled = document.getElementById('setting-sleep-enabled');
const settingSleepStart = document.getElementById('setting-sleep-start');
const settingSleepEnd = document.getElementById('setting-sleep-end');
const sleepTimesRow = document.getElementById('sleep-times-row');

const settingDeepSleepEnabled = document.getElementById('setting-deep-sleep-enabled');
const settingDeepSleepInterval = document.getElementById('setting-deep-sleep-interval');
const deepSleepIntervalRow = document.getElementById('deep-sleep-interval-row');

const settingManualRefresh = document.getElementById('setting-manual-refresh');
const settingNoRefreshStart = document.getElementById('setting-no-refresh-start');
const settingNoRefreshEnd = document.getElementById('setting-no-refresh-end');


function openDeviceSettings() {
    deviceNameInput.value = deviceName || "reTerminal E1001";
    deviceOrientationInput.value = settings.orientation || "landscape";
    deviceDarkModeInput.checked = !!settings.dark_mode;

    settingSleepEnabled.checked = !!settings.sleep_enabled;
    settingSleepStart.value = settings.sleep_start_hour ?? 0;
    settingSleepEnd.value = settings.sleep_end_hour ?? 5;
    sleepTimesRow.style.display = settingSleepEnabled.checked ? 'flex' : 'none';

    settingDeepSleepEnabled.checked = !!settings.deep_sleep_enabled;
    settingDeepSleepInterval.value = settings.deep_sleep_interval ?? 600;
    settingDeepSleepEnabled.checked = !!settings.deep_sleep_enabled;
    settingDeepSleepInterval.value = settings.deep_sleep_interval ?? 600;
    deepSleepIntervalRow.style.display = settingDeepSleepEnabled.checked ? 'flex' : 'none';

    settingManualRefresh.checked = !!settings.manual_refresh_only;

    deviceSettingsModal.classList.remove("hidden");
    deviceSettingsModal.style.display = 'flex';
}

settingSleepEnabled.addEventListener('change', () => {
    sleepTimesRow.style.display = settingSleepEnabled.checked ? 'flex' : 'none';
});

settingDeepSleepEnabled.addEventListener('change', () => {
    deepSleepIntervalRow.style.display = settingDeepSleepEnabled.checked ? 'flex' : 'none';
});

const deviceSettingsBtn = document.getElementById('deviceSettingsBtn');
if (deviceSettingsBtn) {
    deviceSettingsBtn.addEventListener('click', openDeviceSettings);
}

deviceSettingsClose.addEventListener('click', () => {
    deviceSettingsModal.style.display = 'none';
});

deviceSettingsSave.addEventListener('click', async () => {
    deviceName = deviceNameInput.value.trim();
    settings.orientation = deviceOrientationInput.value;
    settings.dark_mode = deviceDarkModeInput.checked;

    settings.sleep_enabled = settingSleepEnabled.checked;
    settings.sleep_start_hour = parseInt(settingSleepStart.value) || 0;
    settings.sleep_end_hour = parseInt(settingSleepEnd.value) || 0;

    settings.deep_sleep_enabled = settingDeepSleepEnabled.checked;
    settings.deep_sleep_interval = parseInt(settingDeepSleepInterval.value) || 600;

    settings.manual_refresh_only = settingManualRefresh.checked;

    applyOrientation(settings.orientation);
    renderCanvas();
    scheduleSnippetUpdate();

    deviceSettingsModal.classList.add("hidden");
    deviceSettingsModal.style.display = 'none';
});

if (updateLayoutBtn) {
    updateLayoutBtn.addEventListener("click", async () => {
        const yaml = snippetBox.value || "";
        console.log("=== Update Layout from YAML clicked ===");
        console.log("YAML length:", yaml.length);
        console.log("YAML first 200 chars:", yaml.substring(0, 200));

        if (!yaml.trim()) {
            sidebarStatus.innerHTML = '<span style="color: var(--danger);">YAML is empty. Generate snippet first or paste YAML.</span>';
            return;
        }

        if (hasHaBackend()) {
            try {
                console.log("Trying HA backend import...");
                const resp = await fetch(`${HA_API_BASE}/import_snippet`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ yaml })
                });

                if (!resp.ok) {
                    const data = await resp.json().catch(() => ({}));
                    const msg = data.message || data.error || `Import failed with status ${resp.status}`;
                    console.error("HA backend import failed:", msg);
                    sidebarStatus.innerHTML = `<span style="color: var(--danger);">Import error: ${msg}</span>`;
                    return;
                }

                const result = await resp.json();
                console.log("HA backend returned layout:", JSON.stringify(result, null, 2));
                applyImportedLayout(result);
                sidebarStatus.innerHTML = '<span style="color: var(--success);">✓ Layout updated from YAML via HA backend</span>';
                return;
            } catch (err) {
                console.warn("HA import_snippet failed, falling back to offline parser", err);
            }
        }

        try {
            console.log("Using offline parser...");
            const offlineLayout = parseSnippetYamlOffline(yaml);
            console.log("Offline parser returned layout:", JSON.stringify(offlineLayout, null, 2));
            applyImportedLayout(offlineLayout);
            sidebarStatus.innerHTML = '<span style="color: var(--success);">✓ Layout updated from YAML (offline parser)</span>';
        } catch (err) {
            console.error("Offline snippet import failed", err);
            sidebarStatus.innerHTML = '<span style="color: var(--danger);">Parse error: ' + err.message + '</span>';
        }
    });
}

if (importSnippetCancel) {
    importSnippetCancel.addEventListener("click", () => {
        closeImportSnippetModal();
    });
}

if (importSnippetConfirm) {
    importSnippetConfirm.addEventListener("click", () => {
        handleImportSnippetConfirm();
    });
}

let CANVAS_WIDTH = 800;
let CANVAS_HEIGHT = 480;

const SNAP_ENABLED_DEFAULT = true;
const SNAP_DISTANCE = 10;
let snapEnabled = SNAP_ENABLED_DEFAULT;

let pages = [];
let settings = {
    orientation: "landscape",
    dark_mode: false,
    sleep_enabled: false,
    sleep_start_hour: 0,
    sleep_enabled: false,
    sleep_start_hour: 0,
    sleep_end_hour: 5,
    manual_refresh_only: false
};
let currentPageIndex = 0;
let widgetsById = new Map();
let selectedWidgetId = null;
let deviceName = "reTerminal E1001";
let currentPageSettingsTarget = null;

// --- Undo/Redo & Clipboard ---
let historyStack = [];
let historyIndex = -1;
let clipboardWidget = null;

function recordHistory() {
    // Deep copy pages
    const state = JSON.parse(JSON.stringify(pages));

    // Check if identical to last state to prevent "phantom" steps
    if (historyIndex >= 0) {
        const lastState = historyStack[historyIndex];
        if (JSON.stringify(lastState) === JSON.stringify(state)) {
            return;
        }
    }

    // Remove any future history if we are in the middle of the stack
    if (historyIndex < historyStack.length - 1) {
        historyStack = historyStack.slice(0, historyIndex + 1);
    }

    historyStack.push(state);
    historyIndex++;

    // Limit stack size
    if (historyStack.length > 50) {
        historyStack.shift();
        historyIndex--;
    }
    // console.log("History recorded. Index:", historyIndex);
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        const state = historyStack[historyIndex];
        pages = JSON.parse(JSON.stringify(state));
        rebuildWidgetsIndex();
        // Ensure currentPageIndex is valid
        if (currentPageIndex >= pages.length) currentPageIndex = pages.length - 1;
        selectedWidgetId = null;
        renderPagesSidebar();
        renderCanvas();
        renderPropertiesPanel();
        scheduleSnippetUpdate();
    }
}

function redo() {
    if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        const state = historyStack[historyIndex];
        pages = JSON.parse(JSON.stringify(state));
        rebuildWidgetsIndex();
        if (currentPageIndex >= pages.length) currentPageIndex = pages.length - 1;
        selectedWidgetId = null;
        renderPagesSidebar();
        renderCanvas();
        renderPropertiesPanel();
        scheduleSnippetUpdate();
    }
}

function copyWidget() {
    if (!selectedWidgetId) return;
    const widget = widgetsById.get(selectedWidgetId);
    if (widget) {
        clipboardWidget = JSON.parse(JSON.stringify(widget));
        // console.log("Copied widget:", clipboardWidget);
    }
}

function pasteWidget() {
    if (!clipboardWidget) return;
    const page = getCurrentPage();
    if (!page) return;

    const newWidget = JSON.parse(JSON.stringify(clipboardWidget));
    newWidget.id = "w_" + Date.now() + "_" + Math.floor(Math.random() * 9999);
    newWidget.x += 10;
    newWidget.y += 10;

    // Keep within bounds
    if (newWidget.x > CANVAS_WIDTH - newWidget.width) newWidget.x = Math.max(0, CANVAS_WIDTH - newWidget.width);
    if (newWidget.y > CANVAS_HEIGHT - newWidget.height) newWidget.y = Math.max(0, CANVAS_HEIGHT - newWidget.height);

    page.widgets.push(newWidget);
    rebuildWidgetsIndex();
    selectedWidgetId = newWidget.id;

    renderCanvas();
    renderPropertiesPanel();
    scheduleSnippetUpdate();
    recordHistory();
}

function initDefaultLayout() {
    pages = [
        {
            id: "page_0",
            name: "Overview",
            widgets: [
                {
                    id: "w_default_temp",
                    type: "sensor_text",
                    x: 40,
                    y: 40,
                    width: 200,
                    height: 60,
                    title: "Temperature",
                    entity_id: "sensor.reterminal_e1001_reterminal_onboard_temperature",
                    props: {
                        label_font_size: 14,
                        value_font_size: 28,
                        value_format: "label_value",
                        color: "black",
                        font_style: "regular",
                        font_weight: 400,
                        italic: false,
                        unit: "°C",
                        precision: 1
                    }
                },
                {
                    id: "w_default_hum",
                    type: "sensor_text",
                    x: 260,
                    y: 40,
                    width: 200,
                    height: 60,
                    title: "Humidity",
                    entity_id: "sensor.reterminal_e1001_reterminal_onboard_humidity",
                    props: {
                        label_font_size: 14,
                        value_font_size: 28,
                        value_format: "label_value",
                        color: "black",
                        font_style: "regular",
                        font_weight: 400,
                        italic: false,
                        unit: "%",
                        precision: 1
                    }
                }
            ]
        }
    ];
    currentPageIndex = 0;
    rebuildWidgetsIndex();
    applyOrientation(settings.orientation || "landscape");
    renderPagesSidebar();
    renderCanvas();
    renderPropertiesPanel();
    recordHistory();
    resizeCanvas();
}

initDefaultLayout();

function applyOrientation(orientation) {
    settings.orientation = orientation === "portrait" ? "portrait" : "landscape";
    const canvasEl = canvas;
    const sizeLabel = document.getElementById("canvasSizeLabel");
    const orientationSelect = document.getElementById("orientationSelect");
    if (orientationSelect) {
        orientationSelect.value = settings.orientation;
    }
    if (settings.orientation === "portrait") {
        CANVAS_WIDTH = 480;
        CANVAS_HEIGHT = 800;
        canvasEl.classList.remove("landscape");
        canvasEl.classList.add("portrait");
        sizeLabel.textContent = "480 x 800";
    } else {
        CANVAS_WIDTH = 800;
        CANVAS_HEIGHT = 480;
        canvasEl.classList.remove("portrait");
        canvasEl.classList.add("landscape");
        sizeLabel.textContent = "800 x 480";
    }
    canvasEl.style.width = CANVAS_WIDTH + "px";
    canvasEl.style.height = CANVAS_HEIGHT + "px";
    renderCanvas();
    resizeCanvas();
}

function resizeCanvas() {
    const canvasEl = document.getElementById("canvas");
    const container = document.querySelector(".canvas-area");
    if (!canvasEl || !container) return;

    // Disable transitions to prevent layout measurement issues
    canvasEl.style.transition = "none";

    // Reset transform to get accurate container dimensions
    canvasEl.style.transform = "none";
    canvasEl.style.marginLeft = "0";
    canvasEl.style.marginTop = "0";
    canvasEl.style.marginBottom = "0";

    const padding = 20;
    const toolbarHeight = 30;
    const availWidth = container.clientWidth - padding;
    const availHeight = container.clientHeight - padding - toolbarHeight;

    const scaleX = availWidth / CANVAS_WIDTH;
    const scaleY = availHeight / CANVAS_HEIGHT;

    let scale = Math.min(scaleX, scaleY, 1);

    // Apply scale with top-left origin
    canvasEl.style.transform = `scale(${scale})`;
    canvasEl.style.transformOrigin = "top left";

    // Calculate centering margins
    const scaledWidth = CANVAS_WIDTH * scale;
    const scaledHeight = CANVAS_HEIGHT * scale;

    const marginLeft = (container.clientWidth - scaledWidth) / 2;

    // Apply margins
    canvasEl.style.marginLeft = `${Math.max(0, marginLeft)}px`;

    const heightDiff = CANVAS_HEIGHT - scaledHeight;
    if (heightDiff > 0) {
        canvasEl.style.marginBottom = `-${heightDiff}px`;
    }

    // Restore transitions after a brief delay
    requestAnimationFrame(() => {
        canvasEl.style.transition = "";
    });
}

// Use ResizeObserver instead of window resize to prevent potential loops
const resizeObserver = new ResizeObserver(entries => {
    // Debounce slightly or just call
    window.requestAnimationFrame(resizeCanvas);
});

const canvasArea = document.querySelector(".canvas-area");
if (canvasArea) {
    resizeObserver.observe(canvasArea);
}

// Call initially
setTimeout(resizeCanvas, 100);

function rebuildWidgetsIndex() {
    widgetsById = new Map();
    for (const page of pages) {
        for (const w of page.widgets) {
            widgetsById.set(w.id, w);
        }
    }
}

function getCurrentPage() {
    return pages[currentPageIndex] || pages[0];
}

function renderPagesSidebar() {
    pageListEl.innerHTML = "";
    pages.forEach((page, index) => {
        const item = document.createElement("div");
        item.className = "item" + (index === currentPageIndex ? " active" : "");

        item.onclick = () => {
            currentPageIndex = index;
            selectedWidgetId = null;
            renderPagesSidebar();
            renderCanvas();
            renderPropertiesPanel();
            scheduleSnippetUpdate();
        };

        const label = document.createElement("span");
        label.className = "label";
        label.textContent = page.name;
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = page.id;
        item.appendChild(label);
        item.appendChild(tag);

        const actionsContainer = document.createElement("div");
        actionsContainer.style.display = "flex";
        actionsContainer.style.gap = "2px";
        actionsContainer.style.marginLeft = "auto";

        const editBtn = document.createElement("button");
        editBtn.textContent = "⚙";
        editBtn.className = "btn btn-secondary";
        editBtn.style.padding = "1px 4px";
        editBtn.style.fontSize = "8px";
        editBtn.title = "Page settings";
        editBtn.onclick = (e) => {
            e.stopPropagation();
            openPageSettingsModal(page);
        };
        actionsContainer.appendChild(editBtn);

        if (pages.length > 1) {
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "🗑";
            deleteBtn.className = "btn btn-secondary";
            deleteBtn.style.padding = "1px 4px";
            deleteBtn.style.fontSize = "8px";
            deleteBtn.style.color = "var(--danger)";
            deleteBtn.title = "Delete page";
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`Delete page "${page.name}"? This cannot be undone.`)) {
                    deletePage(index);
                }
            };
            actionsContainer.appendChild(deleteBtn);
        }

        item.appendChild(actionsContainer);

        pageListEl.appendChild(item);
    });
    const page = getCurrentPage();
    currentPageNameEl.textContent = page ? page.name : "None";
}

function createWidget(type) {
    const page = getCurrentPage();
    if (!page) return;
    const id = "w_" + Date.now() + "_" + Math.floor(Math.random() * 9999);
    const widget = {
        id,
        type,
        x: 40,
        y: 40,
        width: 120,
        height: 40,
        title: "",
        entity_id: "",
        props: {}
    };

    if (type === "label" || type === "text") {
        widget.type = "text";
        widget.props.text = "Text";
        widget.props.font_size = 20;
        widget.props.font_family = "Roboto";
        widget.props.color = "black";
        widget.props.font_weight = 400;  // Regular
        widget.props.italic = false;
        widget.props.bpp = 1;  // No anti-aliasing by default
    } else if (type === "sensor_text") {
        widget.type = "sensor_text";
        widget.props.label_font_size = 14;
        widget.props.value_font_size = 20;
        widget.props.value_format = "label_value";
        widget.props.color = "black";
        widget.props.font_style = "regular";
        widget.props.font_weight = 400;  // Regular
        widget.props.italic = false;
        widget.props.unit = "";
        widget.props.precision = -1;
        widget.entity_id = "";
        widget.title = "";
    } else if (type === "datetime") {
        widget.type = "datetime";
        widget.width = 200;
        widget.height = 60;
        widget.props.format = "time_date";
        widget.props.time_font_size = 28;
        widget.props.date_font_size = 16;
        widget.props.color = "black";
    } else if (type === "progress_bar") {
        widget.type = "progress_bar";
        widget.width = 200;
        widget.height = 40;
        widget.entity_id = "";
        widget.title = "";
        widget.props.show_label = true;
        widget.props.show_percentage = true;
        widget.props.bar_height = 15;
        widget.props.border_width = 1;
        widget.props.color = "black";
    } else if (type === "battery_icon") {
        widget.type = "battery_icon";
        widget.width = 60;
        widget.height = 60;
        widget.entity_id = "";
        widget.props.size = 24;
        widget.props.color = "black";
    } else if (type === "weather_icon") {
        widget.type = "weather_icon";
        widget.width = 48;
        widget.height = 48;
        widget.entity_id = "";
        widget.props.size = 48;
        widget.props.color = "black";
        widget.props.icon_map = "default"; // or "ha_weather_icon_map"
    } else if (type === "puppet") {
        widget.type = "puppet";
        widget.props.image_url = "";
        widget.props.image_type = "RGB565";  // ESPHome default for color displays
        widget.props.transparency = "opaque";  // No transparency by default
    } else if (type === "shape_rect") {
        widget.type = "shape_rect";
        widget.props.fill = false;
        widget.props.border_width = 1;
        widget.props.color = "black";
        widget.props.opacity = 100;
    } else if (type === "shape_circle") {
        widget.type = "shape_circle";
        widget.width = 40;
        widget.height = 40;
        widget.props.fill = false;
        widget.props.border_width = 1;
        widget.props.color = "black";
        widget.props.opacity = 100;
    } else if (type === "icon") {
        widget.type = "icon";
        widget.width = 60;
        widget.height = 60;
        widget.props.code = "F0595";
        widget.props.size = 40;
        widget.props.color = "black";
        widget.props.font_ref = "font_mdi_medium";
        widget.props.fit_icon_to_frame = true;
    } else if (type === "line") {
        widget.type = "line";
        widget.width = 80;
        widget.height = 0;
        widget.props.stroke_width = 1;
        widget.props.color = "black";
    } else if (type === "image") {
        widget.type = "image";
        widget.width = 200;
        widget.height = 150;
        widget.props.path = "";
        widget.props.invert = false;
    } else if (type === "online_image") {
        widget.type = "online_image";
        widget.width = 800;
        widget.height = 480;
        widget.props.url = "";
        widget.props.interval_s = 300;
    } else if (type === "graph") {
        widget.type = "graph";
        widget.width = 200;
        widget.height = 100;
        widget.entity_id = "";
        widget.props.duration = "1h";
        widget.props.border = true;
        widget.props.grid = true;
        widget.props.color = "black";
        widget.props.title = ""; // Graph title
        widget.props.x_grid = "";  // e.g., "10min"
        widget.props.y_grid = "";  // e.g., "1.0"
        widget.props.line_thickness = 3;
        widget.props.line_type = "SOLID";  // SOLID, DOTTED, DASHED
        widget.props.continuous = true;
        widget.props.min_value = "";
        widget.props.max_value = "";
        widget.props.min_range = "";
        widget.props.max_range = "";
    }

    page.widgets.push(widget);
    widgetsById.set(widget.id, widget);
    selectedWidgetId = widget.id;
    renderCanvas();
    renderPropertiesPanel();
    scheduleSnippetUpdate();
    recordHistory();
}

function onWidgetPaletteClick(e) {
    const item = e.target.closest(".item[data-widget-type]");
    if (!item) return;
    const type = item.getAttribute("data-widget-type");
    createWidget(type);
}

function clearSnapGuides() {
    const guides = canvas.querySelectorAll(".snap-guide");
    guides.forEach((g) => g.remove());
}

function addSnapGuideVertical(x) {
    const guide = document.createElement("div");
    guide.className = "snap-guide snap-guide-vertical";
    guide.style.left = `${x}px`;
    canvas.appendChild(guide);
}

function addSnapGuideHorizontal(y) {
    const guide = document.createElement("div");
    guide.className = "snap-guide snap-guide-horizontal";
    guide.style.top = `${y}px`;
    canvas.appendChild(guide);
}

function getSnapLines(excludeWidgetId) {
    const page = getCurrentPage();
    const vertical = [];
    const horizontal = [];

    vertical.push(0, CANVAS_WIDTH / 2, CANVAS_WIDTH);
    horizontal.push(0, CANVAS_HEIGHT / 2, CANVAS_HEIGHT);

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

    return {
        vertical,
        horizontal
    };
}

function applySnapToPosition(widget, x, y, ev) {
    if (!snapEnabled || (ev && ev.altKey)) {
        clearSnapGuides();
        return { x: Math.round(x), y: Math.round(y) };
    }

    const page = getCurrentPage();
    if (!page) {
        clearSnapGuides();
        return { x: Math.round(x), y: Math.round(y) };
    }

    const snapLines = getSnapLines(widget.id);
    const w = widget.width || 0;
    const h = widget.height || 0;

    const left = x;
    const right = x + w;
    const cx = x + w / 2;
    const top = y;
    const bottom = y + h;
    const cy = y + h / 2;

    let snappedX = x;
    let snappedY = y;
    let snappedV = null;
    let snappedH = null;

    const vCandidates = [
        { val: left, offset: (val, line) => line, apply: (line) => (snappedX = line) },
        { val: cx, offset: (val, line) => line - w / 2, apply: (line) => (snappedX = line - w / 2) },
        { val: right, offset: (val, line) => line - w, apply: (line) => (snappedX = line - w) }
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

    const hCandidates = [
        { val: top, apply: (line) => (snappedY = line) },
        { val: cy, apply: (line) => (snappedY = line - h / 2) },
        { val: bottom, apply: (line) => (snappedY = line - h) }
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

    snappedX = Math.max(0, Math.min(CANVAS_WIDTH - w, snappedX));
    snappedY = Math.max(0, Math.min(CANVAS_HEIGHT - h, snappedY));

    clearSnapGuides();
    if (snappedV != null) addSnapGuideVertical(snappedV);
    if (snappedH != null) addSnapGuideHorizontal(snappedH);

    return {
        x: Math.round(snappedX),
        y: Math.round(snappedY)
    };
}

function renderCanvas() {
    const page = getCurrentPage();
    const existingGrid = canvas.querySelector(".canvas-grid");
    const existingGuides = canvas.querySelectorAll(".snap-guide");
    canvas.innerHTML = "";
    if (existingGrid) canvas.appendChild(existingGrid);
    existingGuides.forEach((g) => canvas.appendChild(g));
    if (!page) return;

    for (const widget of page.widgets) {
        const el = document.createElement("div");
        el.className = "widget";
        el.style.left = widget.x + "px";
        el.style.top = widget.y + "px";
        el.style.width = widget.width + "px";
        el.style.height = widget.height + "px";
        el.dataset.id = widget.id;

        if (widget.id === selectedWidgetId) {
            el.classList.add("active");
        }

        const type = (widget.type || "").toLowerCase();
        const props = widget.props || {};

        if (type === "icon") {
            const code = (props.code || "").trim().toUpperCase();
            const sizeManual = parseInt(props.size || 40, 10) || 40;
            const hex = code && code.match(/^F[0-9A-F]{4}$/i) ? code : "F0595";
            const cp = 0xf0000 + parseInt(hex.slice(1), 16);
            const ch = String.fromCodePoint(cp);

            const color = props.color || "black";
            const colorStyle =
                color === "white"
                    ? "#ffffff"
                    : color === "gray"
                        ? "#aaaaaa"
                        : "#000000";

            const fit = !!props.fit_icon_to_frame;
            el.classList.add("mdi-icon-preview");
            el.style.fontFamily = "MDI, system-ui, -apple-system, BlinkMacSystemFont, -sans-serif";
            el.style.lineHeight = "1";
            el.style.color = colorStyle;

            if (fit) {
                const padding = 4;
                const maxW = Math.max(8, (widget.width || 0) - padding * 2);
                const maxH = Math.max(8, (widget.height || 0) - padding * 2);
                const size = Math.max(8, Math.min(maxW, maxH));
                el.style.display = "flex";
                el.style.alignItems = "center";
                el.style.justifyContent = "center";
                el.style.fontSize = size + "px";
            } else {
                el.style.fontSize = sizeManual + "px";
            }

            el.textContent = ch;
        } else if (type === "shape_rect" || type === "shape_circle" || type === "line") {
            const color = props.color || "black";
            const borderWidth = parseInt(props.border_width != null ? props.border_width : 1, 10);
            const fill = !!props.fill;
            const opacityVal = parseInt(props.opacity != null ? props.opacity : 100, 10);
            const opacity = Math.max(0, Math.min(100, isNaN(opacityVal) ? 100 : opacityVal)) / 100;
            const strokeWidthVal = parseInt(
                props.stroke_width != null ? props.stroke_width : (borderWidth || 1),
                10
            );
            const strokeWidth = Math.max(1, isNaN(strokeWidthVal) ? 1 : strokeWidthVal);

            const colorValue =
                color === "white"
                    ? "#ffffff"
                    : color === "gray"
                        ? "#aaaaaa"
                        : "#000000";

            if (type === "shape_rect") {
                el.style.boxSizing = "border-box";
                el.style.border = borderWidth > 0 ? borderWidth + "px solid " + colorValue : "none";
                el.style.backgroundColor = fill ? colorValue : "transparent";
                el.style.opacity = fill ? opacity : 1;
            } else if (type === "shape_circle") {
                el.style.boxSizing = "border-box";
                el.style.borderRadius = "999px";
                el.style.border = borderWidth > 0 ? borderWidth + "px solid " + colorValue : "none";
                el.style.backgroundColor = fill ? colorValue : "transparent";
                el.style.opacity = fill ? opacity : 1;
            } else if (type === "line") {
                el.style.boxSizing = "border-box";
                el.style.height = strokeWidth + "px";
                el.style.width = (widget.width || 80) + "px";
                el.style.backgroundColor = colorValue;
            }
        } else if (type === "image") {
            const path = props.path || "";
            const invert = !!props.invert;

            el.style.boxSizing = "border-box";
            el.style.border = "2px dashed #aaaaaa";
            el.style.backgroundColor = "#f5f5f5";
            el.style.display = "flex";
            el.style.alignItems = "center";
            el.style.justifyContent = "center";
            el.style.overflow = "hidden";

            if (path) {
                const filename = path.split("/").pop();

                el.innerHTML = "";

                const img = document.createElement("img");
                img.style.maxWidth = "100%";
                img.style.maxHeight = "100%";
                img.style.objectFit = "contain";
                img.draggable = false;

                if (invert) {
                    img.style.filter = "invert(1)";
                }

                img.onerror = () => {
                    el.innerHTML = "<div style='text-align:center;color:#666;font-size:11px;padding:8px;line-height:1.4;'>" +
                        "🖼️<br/><strong>" + filename + "</strong><br/>" +
                        "<span style='color:#999;font-size:9px;'>" +
                        (invert ? "(inverted) " : "") +
                        widget.width + "×" + widget.height + "px<br/>" +
                        "File not found or not accessible</span></div>";
                };

                img.onload = () => {
                    const overlay = document.createElement("div");
                    overlay.style.position = "absolute";
                    overlay.style.bottom = "2px";
                    overlay.style.right = "2px";
                    overlay.style.background = "rgba(0,0,0,0.6)";
                    overlay.style.color = "white";
                    overlay.style.padding = "2px 4px";
                    overlay.style.fontSize = "8px";
                    overlay.style.borderRadius = "2px";
                    overlay.textContent = filename + " • " + widget.width + "×" + widget.height + "px";
                    el.style.position = "relative";
                    el.appendChild(overlay);
                };

                const proxyUrl = "/api/reterminal_dashboard/image_proxy?path=" + encodeURIComponent(path);
                img.src = proxyUrl;
                el.appendChild(img);
            } else {
                const placeholder = document.createElement("div");
                placeholder.style.textAlign = "center";
                placeholder.style.color = "#aaa";
                placeholder.style.fontSize = "11px";
                placeholder.innerHTML = "🖼️<br/>Image Widget<br/><span style='font-size:9px;color:#ccc;'>Enter path in properties →</span>";
                el.appendChild(placeholder);
            }
        } else if (type === "datetime") {
            const format = props.format || "time_date";
            const timeFontSize = props.time_font_size || 28;
            const dateFontSize = props.date_font_size || 16;
            const color = props.color || "black";
            const colorStyle =
                color === "white"
                    ? "#ffffff"
                    : color === "gray"
                        ? "#aaaaaa"
                        : "#000000";

            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

            el.style.display = "flex";
            el.style.flexDirection = "column";
            el.style.justifyContent = "center";
            el.style.alignItems = "center";
            el.style.color = colorStyle;

            if (format === "time_only") {
                const timeEl = document.createElement("div");
                timeEl.style.fontSize = timeFontSize + "px";
                timeEl.style.fontWeight = "bold";
                timeEl.textContent = timeStr;
                el.appendChild(timeEl);
            } else if (format === "date_only") {
                const dateEl = document.createElement("div");
                dateEl.style.fontSize = dateFontSize + "px";
                dateEl.textContent = dateStr;
                el.appendChild(dateEl);
            } else {
                const timeEl = document.createElement("div");
                timeEl.style.fontSize = timeFontSize + "px";
                timeEl.style.fontWeight = "bold";
                timeEl.textContent = timeStr;
                const dateEl = document.createElement("div");
                dateEl.style.fontSize = dateFontSize + "px";
                dateEl.style.marginTop = "2px";
                dateEl.textContent = dateStr;
                el.appendChild(timeEl);
                el.appendChild(dateEl);
            }
        } else if (type === "puppet") {
            const url = props.image_url || "";
            el.style.overflow = "hidden";
            el.style.backgroundColor = "#f0f0f0";
            el.style.display = "flex";
            el.style.alignItems = "center";
            el.style.justifyContent = "center";

            if (url) {
                const img = document.createElement("img");
                img.src = url;
                img.style.width = "100%";
                img.style.height = "100%";
                img.style.objectFit = "contain";
                img.draggable = false;

                img.onerror = () => {
                    el.innerHTML = "<div style='text-align:center;color:#666;font-size:10px;padding:4px;'>" +
                        "Puppet<br/>(Load Failed)</div>";
                };

                el.appendChild(img);
            } else {
                const placeholder = document.createElement("div");
                placeholder.style.textAlign = "center";
                placeholder.style.color = "#aaa";
                placeholder.style.fontSize = "10px";
                placeholder.innerHTML = "Puppet<br/><span style='font-size:9px;'>Enter URL</span>";
                el.appendChild(placeholder);
            }
        } else if (type === "progress_bar") {
            const entityId = widget.entity_id || "";
            const label = widget.title || "";
            const showLabel = props.show_label !== false;
            const showPercentage = props.show_percentage !== false;
            const barHeight = props.bar_height || 15;
            const borderWidth = props.border_width || 1;
            const color = props.color || "black";
            const colorStyle =
                color === "white"
                    ? "#ffffff"
                    : color === "gray"
                        ? "#aaaaaa"
                        : "#000000";

            let progress = 50;
            if (hasHaBackend() && entityId) {
                const state = getEntityState(entityId);
                if (state !== null && state !== undefined) {
                    const val = parseFloat(state);
                    if (!isNaN(val)) {
                        progress = Math.max(0, Math.min(100, val));
                    }
                }
            }

            el.style.display = "flex";
            el.style.flexDirection = "column";
            el.style.justifyContent = "center";
            el.style.gap = "4px";
            el.style.color = colorStyle;

            if (showLabel && (label || showPercentage)) {
                const labelRow = document.createElement("div");
                labelRow.style.display = "flex";
                labelRow.style.justifyContent = "space-between";
                labelRow.style.alignItems = "center";
                labelRow.style.fontSize = "12px";
                labelRow.style.paddingBottom = "2px";

                if (label) {
                    const labelSpan = document.createElement("span");
                    labelSpan.textContent = label;
                    labelRow.appendChild(labelSpan);
                }

                if (showPercentage) {
                    const pctSpan = document.createElement("span");
                    pctSpan.textContent = Math.round(progress) + "%";
                    labelRow.appendChild(pctSpan);
                }

                el.appendChild(labelRow);
            }

            const barContainer = document.createElement("div");
            barContainer.style.width = "100%";
            barContainer.style.height = barHeight + "px";
            barContainer.style.border = borderWidth + "px solid " + colorStyle;
            barContainer.style.borderRadius = "2px";
            barContainer.style.position = "relative";
            barContainer.style.overflow = "hidden";
            barContainer.style.backgroundColor = color === "white" ? "#000" : "#fff";

            const barFill = document.createElement("div");
            barFill.style.width = progress + "%";
            barFill.style.height = "100%";
            barFill.style.backgroundColor = colorStyle;
            barFill.style.transition = "width 0.3s ease";

            barContainer.appendChild(barFill);
            el.appendChild(barContainer);
        } else if (type === "battery_icon") {
            const entityId = widget.entity_id || "";
            const size = parseInt(props.size || 48, 10) || 48;
            const color = props.color || "black";
            const colorStyle =
                color === "white"
                    ? "#ffffff"
                    : color === "gray"
                        ? "#aaaaaa"
                        : "#000000";

            let batteryLevel = 75;
            if (hasHaBackend() && entityId) {
                const state = getEntityState(entityId);
                if (state !== null && state !== undefined) {
                    const val = parseFloat(state);
                    if (!isNaN(val)) {
                        batteryLevel = Math.max(0, Math.min(100, val));
                    }
                }
            }

            let iconCode = "F0079";
            if (batteryLevel <= 10) iconCode = "F007A";
            else if (batteryLevel <= 20) iconCode = "F007B";
            else if (batteryLevel <= 30) iconCode = "F007C";
            else if (batteryLevel <= 40) iconCode = "F007D";
            else if (batteryLevel <= 50) iconCode = "F007E";
            else if (batteryLevel <= 60) iconCode = "F007F";
            else if (batteryLevel <= 70) iconCode = "F0080";
            else if (batteryLevel <= 80) iconCode = "F0081";
            else if (batteryLevel <= 90) iconCode = "F0082";

            const cp = 0xf0000 + parseInt(iconCode.slice(1), 16);
            const ch = String.fromCodePoint(cp);

            el.classList.add("mdi-icon-preview");
            el.style.fontFamily = "MDI, system-ui, -apple-system, BlinkMacSystemFont, -sans-serif";
            el.style.lineHeight = "1";
            el.style.color = colorStyle;
            el.style.display = "flex";
            el.style.flexDirection = "column";
            el.style.alignItems = "center";
            el.style.justifyContent = "center";
            el.style.fontSize = size + "px";
            el.textContent = ch;

            const pctLabel = document.createElement("div");
            pctLabel.style.fontSize = "10px";
            pctLabel.style.marginTop = "2px";
            pctLabel.textContent = Math.round(batteryLevel) + "%";
            el.appendChild(pctLabel);
        } else if (type === "weather_icon") {
            const entityId = widget.entity_id || "";
            const size = parseInt(props.size || 48, 10) || 48;
            const color = props.color || "black";
            const colorStyle =
                color === "white"
                    ? "#ffffff"
                    : color === "gray"
                        ? "#aaaaaa"
                        : "#000000";

            let weatherState = "sunny"; // Default for preview
            if (hasHaBackend() && entityId) {
                const state = getEntityState(entityId);
                if (state !== null && state !== undefined) {
                    weatherState = String(state).toLowerCase();
                }
            }

            // Simple mapping for preview, actual mapping is done in ESPHome
            let iconCode = "F0591"; // Default to weather-sunny
            switch (weatherState) {
                case "clear-night": iconCode = "F0594"; break;
                case "cloudy": iconCode = "F0595"; break;
                case "fog": iconCode = "F192C"; break;
                case "hail": iconCode = "F0E6E"; break;
                case "lightning": iconCode = "F0598"; break;
                case "lightning-rainy": iconCode = "F067F"; break;
                case "partlycloudy": iconCode = "F0599"; break;
                case "pouring": iconCode = "F06A1"; break;
                case "rainy": iconCode = "F0596"; break;
                case "snowy": iconCode = "F0590"; break;
                case "snowy-rainy": iconCode = "F0F32"; break;
                case "sunny": iconCode = "F0591"; break;
                case "windy": iconCode = "F0597"; break;
                case "windy-variant": iconCode = "F0F2F"; break;
                case "exceptional": iconCode = "F0024"; break;
            }

            const cp = 0xf0000 + parseInt(iconCode.slice(1), 16);
            const ch = String.fromCodePoint(cp);

            el.classList.add("mdi-icon-preview");
            el.style.fontFamily = "MDI, system-ui, -apple-system, BlinkMacSystemFont, -sans-serif";
            el.style.lineHeight = "1";
            el.style.color = colorStyle;
            el.style.display = "flex";
            el.style.flexDirection = "column";
            // Align Top-Left to match ESPHome TextAlign::TOP_LEFT
            el.style.alignItems = "flex-start";
            el.style.justifyContent = "flex-start";
            el.style.fontSize = size + "px";
            el.textContent = ch;

            if (!entityId) {
                const label = document.createElement("div");
                label.style.fontSize = "10px";
                label.style.marginTop = "2px";
                label.textContent = "No Entity";
                el.appendChild(label);
            }
        } else if (type === "graph") {
            const entityId = widget.entity_id || "";
            const borderEnabled = props.border !== false;
            const gridEnabled = props.grid !== false; // Note: props.grid is not really used, we use x_grid/y_grid presence
            const color = props.color || "black";
            const colorStyle =
                color === "white"
                    ? "#ffffff"
                    : color === "gray"
                        ? "#aaaaaa"
                        : "#000000";

            el.style.boxSizing = "border-box";
            el.style.backgroundColor = "#ffffff";
            el.style.position = "relative";
            el.style.overflow = "hidden";

            if (borderEnabled) {
                el.style.border = "2px solid " + colorStyle;
            }

            // Create SVG for the graph
            const svgNS = "http://www.w3.org/2000/svg";
            const svg = document.createElementNS(svgNS, "svg");
            svg.setAttribute("width", "100%");
            svg.setAttribute("height", "100%");
            svg.style.display = "block";

            // Helper to parse duration/time strings to seconds
            const parseTime = (str) => {
                if (!str) return 0;
                const match = str.match(/^(\d+(?:\.\d+)?)\s*(s|min|h|d)?/);
                if (!match) return 0;
                const val = parseFloat(match[1]);
                const unit = match[2] || "s";
                if (unit === "min") return val * 60;
                if (unit === "h") return val * 3600;
                if (unit === "d") return val * 86400;
                return val;
            };

            // Calculate grid lines
            const durationSec = parseTime(props.duration || "1h");
            const xGridSec = parseTime(props.x_grid);

            let xDivisions = 4; // Default
            if (durationSec > 0 && xGridSec > 0) {
                xDivisions = Math.floor(durationSec / xGridSec);
                // Limit to reasonable number for preview
                if (xDivisions > 20) xDivisions = 20;
            }

            let yDivisions = 2; // Default
            const yGridVal = parseFloat(props.y_grid);
            if (!isNaN(yGridVal) && yGridVal > 0) {
                // Estimate based on min/max or default range
                // This is hard to preview accurately without real data range, so we'll just show a few lines
                // or try to use min/max if set
                const min = parseFloat(props.min_value) || 0;
                const max = parseFloat(props.max_value) || 100;
                if (max > min) {
                    yDivisions = Math.floor((max - min) / yGridVal);
                    if (yDivisions > 10) yDivisions = 10;
                }
            }

            const gridGroup = document.createElementNS(svgNS, "g");
            gridGroup.setAttribute("stroke", "#e0e0e0");
            gridGroup.setAttribute("stroke-width", "1");

            // Vertical grid lines
            for (let i = 0; i <= xDivisions; i++) {
                if (i === 0 && borderEnabled) continue; // Skip first if border exists
                if (i === xDivisions && borderEnabled) continue; // Skip last

                const line = document.createElementNS(svgNS, "line");
                const x = (i / xDivisions * 100) + "%";
                line.setAttribute("x1", x);
                line.setAttribute("y1", "0");
                line.setAttribute("x2", x);
                line.setAttribute("y2", "100%");
                gridGroup.appendChild(line);
            }

            // Horizontal grid lines
            for (let i = 0; i <= yDivisions; i++) {
                if (i === 0 && borderEnabled) continue;
                if (i === yDivisions && borderEnabled) continue;

                const line = document.createElementNS(svgNS, "line");
                const y = (i / yDivisions * 100) + "%";
                line.setAttribute("x1", "0");
                line.setAttribute("y1", y);
                line.setAttribute("x2", "100%");
                line.setAttribute("y2", y);
                gridGroup.appendChild(line);
            }
            svg.appendChild(gridGroup);

            // Generate sample data points for preview
            const sampleData = [
                0.3, 0.5, 0.7, 0.8, 0.65, 0.9, 0.4, 0.2, 0.35, 0.6, 0.75, 0.55
            ];

            // Create polyline for the graph
            const polyline = document.createElementNS(svgNS, "polyline");

            // Use normalized coordinates (0-100) for the points to match viewBox
            const points = sampleData.map((val, idx) => {
                const x = (idx / (sampleData.length - 1)) * 100;
                const y = 100 - (val * 100); // Invert Y because SVG 0 is top
                return `${x},${y}`;
            }).join(" ");

            polyline.setAttribute("points", points);
            polyline.setAttribute("fill", "none");
            polyline.setAttribute("stroke", colorStyle);
            const thickness = parseInt(props.line_thickness || 3, 10);
            polyline.setAttribute("stroke-width", thickness);
            polyline.setAttribute("stroke-linejoin", "round");

            const lineType = props.line_type || "SOLID";
            if (lineType === "DASHED") {
                polyline.setAttribute("stroke-dasharray", "5,5");
            } else if (lineType === "DOTTED") {
                polyline.setAttribute("stroke-dasharray", "2,2");
            }

            svg.appendChild(polyline);
            el.appendChild(svg);

            // Add label if no entity selected OR if title is set
            if (widget.title) {
                const label = document.createElement("div");
                label.style.position = "absolute";
                label.style.top = "2px";
                label.style.left = "50%";
                label.style.transform = "translateX(-50%)";
                label.style.fontSize = "10px";
                label.style.color = colorStyle;
                label.style.backgroundColor = "rgba(255,255,255,0.7)";
                label.style.padding = "0 4px";
                label.style.borderRadius = "2px";
                label.style.whiteSpace = "nowrap";
                label.textContent = widget.title;
                el.appendChild(label);
            } else if (!entityId) {
                const label = document.createElement("div");
                label.style.position = "absolute";
                label.style.top = "50%";
                label.style.left = "50%";
                label.style.transform = "translate(-50%, -50%)";
                label.style.fontSize = "10px";
                label.style.color = "#999";
                label.style.backgroundColor = "rgba(255,255,255,0.8)";
                label.style.padding = "2px 6px";
                label.textContent = "graph (No Entity)";
                el.appendChild(label);
            }
        } else {
            const color = props.color || "black";
            const opacityVal = parseInt(props.opacity != null ? props.opacity : 100, 10);
            const opacity = Math.max(0, Math.min(100, isNaN(opacityVal) ? 100 : opacityVal)) / 100;

            const colorStyle =
                color === "white"
                    ? "#ffffff"
                    : color === "gray"
                        ? "#aaaaaa"
                        : "#000000";

            if (type === "sensor_text") {
                const entityId = widget.entity_id || "";
                const label = widget.title || "";
                const valueFormat = props.value_format || "value_only";
                const labelFontSize = props.label_font_size || 14;
                const valueFontSize = props.value_font_size || 20;
                const fontFamily = props.font_family || "Inter";

                let displayValue = "--";

                if (hasHaBackend() && entityId) {
                    const state = getEntityState(entityId);
                    console.log(`[Canvas] Rendering sensor_text: entity=${entityId}, state=${state}, label=${label}, format=${valueFormat}`);

                    if (state !== null && state !== undefined) {
                        const precision = parseInt(props.precision, 10);
                        if (!isNaN(precision) && precision >= 0) {
                            const strState = String(state);
                            // Try to match number + optional unit
                            const match = strState.match(/^([-+]?\d*\.?\d+)(.*)$/);
                            if (match) {
                                const val = parseFloat(match[1]);
                                const unit = match[2] || "";
                                if (!isNaN(val)) {
                                    displayValue = val.toFixed(precision) + unit;
                                } else {
                                    displayValue = strState;
                                }
                            } else {
                                // Fallback for pure numbers or non-matching formats
                                const val = parseFloat(state);
                                if (!isNaN(val)) {
                                    displayValue = val.toFixed(precision);
                                } else {
                                    displayValue = strState;
                                }
                            }
                        } else {
                            displayValue = String(state);
                        }
                    } else {
                        displayValue = "Loading...";
                    }
                }

                const body = document.createElement("div");
                body.style.color = colorStyle;
                body.style.opacity = opacity;
                body.style.fontFamily = fontFamily + ", sans-serif";
                const fontWeight = props.font_weight || 400;
                body.style.fontWeight = String(fontWeight);

                if (valueFormat === "label_value" && label) {
                    body.style.display = "flex";
                    body.style.alignItems = "baseline";
                    body.style.gap = "4px";

                    const labelSpan = document.createElement("span");
                    labelSpan.style.fontSize = labelFontSize + "px";
                    labelSpan.textContent = label + ":";

                    const valueSpan = document.createElement("span");
                    valueSpan.style.fontSize = valueFontSize + "px";
                    valueSpan.textContent = displayValue;

                    body.appendChild(labelSpan);
                    body.appendChild(valueSpan);
                } else if (valueFormat === "label_newline_value" && label) {
                    body.style.display = "flex";
                    body.style.flexDirection = "column";
                    body.style.gap = "2px";

                    const labelDiv = document.createElement("div");
                    labelDiv.style.fontSize = labelFontSize + "px";
                    labelDiv.textContent = label;

                    const valueDiv = document.createElement("div");
                    valueDiv.style.fontSize = valueFontSize + "px";
                    valueDiv.textContent = displayValue;

                    body.appendChild(labelDiv);
                    body.appendChild(valueDiv);
                } else {
                    body.style.fontSize = valueFontSize + "px";
                    body.textContent = displayValue;
                }

                el.appendChild(body);
            } else {
                const fontSize = props.font_size || 16;
                const fontFamily = props.font_family || "Inter";
                const fontWeight = props.font_weight || 400;
                const fontStyle = props.italic ? "italic" : "normal";
                const body = document.createElement("div");
                body.style.fontSize = fontSize + "px";
                body.style.fontFamily = fontFamily + ", sans-serif";
                body.style.fontWeight = String(fontWeight);
                body.style.fontStyle = fontStyle;
                body.style.color = colorStyle;
                body.style.opacity = opacity;
                body.textContent = props.text || widget.title || "Text";
                el.appendChild(body);
            }
        }

        const handle = document.createElement("div");
        handle.className = "widget-resize-handle";
        el.appendChild(handle);

        el.addEventListener("mousedown", (ev) => onWidgetMouseDown(ev, widget.id));
        canvas.appendChild(el);
    }
}

// Layer ordering functions
function moveWidgetToFront(widgetId) {
    const page = getCurrentPage();
    if (!page) return;
    const index = page.widgets.findIndex(w => w.id === widgetId);
    if (index === -1 || index === page.widgets.length - 1) return;
    const widget = page.widgets.splice(index, 1)[0];
    page.widgets.push(widget);
    renderCanvas();
    scheduleSnippetUpdate();
}

function moveWidgetToBack(widgetId) {
    const page = getCurrentPage();
    if (!page) return;
    const index = page.widgets.findIndex(w => w.id === widgetId);
    if (index === -1 || index === 0) return;
    const widget = page.widgets.splice(index, 1)[0];
    page.widgets.unshift(widget);
    renderCanvas();
    scheduleSnippetUpdate();
}

function moveWidgetForward(widgetId) {
    const page = getCurrentPage();
    if (!page) return;
    const index = page.widgets.findIndex(w => w.id === widgetId);
    if (index === -1 || index === page.widgets.length - 1) return;
    [page.widgets[index], page.widgets[index + 1]] = [page.widgets[index + 1], page.widgets[index]];
    renderCanvas();
    scheduleSnippetUpdate();
}

function moveWidgetBackward(widgetId) {
    const page = getCurrentPage();
    if (!page) return;
    const index = page.widgets.findIndex(w => w.id === widgetId);
    if (index === -1 || index === 0) return;
    [page.widgets[index], page.widgets[index - 1]] = [page.widgets[index - 1], page.widgets[index]];
    renderCanvas();
    scheduleSnippetUpdate();
}

function renderPropertiesPanel() {
    const panel = propertiesPanel;
    panel.innerHTML = "";

    const widget = selectedWidgetId ? widgetsById.get(selectedWidgetId) : null;
    if (!widget) {
        const info = document.createElement("div");
        info.className = "field";
        info.innerHTML =
            '<span style="font-size:9px;color:var(--muted);">Select a widget on the canvas to edit its properties.</span>';
        panel.appendChild(info);
        return;
    }

    const type = (widget.type || "").toLowerCase();
    widget.props = widget.props || {};

    function addLabeledInput(label, typeAttr, value, onChange) {
        const wrap = document.createElement("div");
        wrap.className = "field";
        const lbl = document.createElement("div");
        lbl.className = "prop-label";
        lbl.textContent = label;
        const inp = document.createElement("input");
        inp.className = "prop-input";
        inp.type = typeAttr;
        inp.value = value != null ? value : "";
        inp.addEventListener("input", () => {
            onChange(inp.value);
            scheduleSnippetUpdate();
        });
        wrap.appendChild(lbl);
        wrap.appendChild(inp);
        panel.appendChild(wrap);
        return inp;
    }

    function addSelect(label, value, options, onChange) {
        const wrap = document.createElement("div");
        wrap.className = "field";
        const lbl = document.createElement("div");
        lbl.className = "prop-label";
        lbl.textContent = label;
        const sel = document.createElement("select");
        sel.className = "prop-input";
        options.forEach((optVal) => {
            const opt = document.createElement("option");
            opt.value = optVal;
            opt.textContent = optVal;
            if (optVal === value) opt.selected = true;
            sel.appendChild(opt);
        });
        sel.addEventListener("change", () => {
            onChange(sel.value);
            scheduleSnippetUpdate();
        });
        wrap.appendChild(lbl);
        wrap.appendChild(sel);
        panel.appendChild(wrap);
        return sel;
    }

    addLabeledInput("Position X", "number", widget.x, (v) => {
        widget.x = parseInt(v || "0", 10) || 0;
        renderCanvas();
    });
    addLabeledInput("Position Y", "number", widget.y, (v) => {
        widget.y = Math.max(0, Math.min(CANVAS_HEIGHT, parseInt(v || "0", 10) || 0));
        renderCanvas();
    });

    // Layer ordering buttons
    const layerWrap = document.createElement("div");
    layerWrap.className = "field";
    layerWrap.style.marginTop = "8px";

    const layerLbl = document.createElement("div");
    layerLbl.className = "prop-label";
    layerLbl.textContent = "Layer Order";
    layerWrap.appendChild(layerLbl);

    const layerBtns = document.createElement("div");
    layerBtns.style.display = "grid";
    layerBtns.style.gridTemplateColumns = "1fr 1fr";
    layerBtns.style.gap = "4px";
    layerBtns.style.marginTop = "4px";

    const btnToFront = document.createElement("button");
    btnToFront.className = "btn btn-secondary";
    btnToFront.textContent = "⬆️ To Front";
    btnToFront.type = "button";
    btnToFront.title = "Bring to front (top layer)";
    btnToFront.style.fontSize = "9px";
    btnToFront.style.padding = "4px 6px";
    btnToFront.addEventListener("click", () => {
        moveWidgetToFront(widget.id);
        renderPropertiesPanel();
    });

    const btnToBack = document.createElement("button");
    btnToBack.className = "btn btn-secondary";
    btnToBack.textContent = "⬇️ To Back";
    btnToBack.type = "button";
    btnToBack.title = "Send to back (bottom layer)";
    btnToBack.style.fontSize = "9px";
    btnToBack.style.padding = "4px 6px";
    btnToBack.addEventListener("click", () => {
        moveWidgetToBack(widget.id);
        renderPropertiesPanel();
    });

    const btnForward = document.createElement("button");
    btnForward.className = "btn btn-secondary";
    btnForward.textContent = "↑ Forward";
    btnForward.type = "button";
    btnForward.title = "Move forward one layer";
    btnForward.style.fontSize = "9px";
    btnForward.style.padding = "4px 6px";
    btnForward.addEventListener("click", () => {
        moveWidgetForward(widget.id);
        renderPropertiesPanel();
    });

    const btnBackward = document.createElement("button");
    btnBackward.className = "btn btn-secondary";
    btnBackward.textContent = "↓ Backward";
    btnBackward.type = "button";
    btnBackward.title = "Move backward one layer";
    btnBackward.style.fontSize = "9px";
    btnBackward.style.padding = "4px 6px";
    btnBackward.addEventListener("click", () => {
        moveWidgetBackward(widget.id);
        renderPropertiesPanel();
    });

    layerBtns.appendChild(btnToFront);
    layerBtns.appendChild(btnToBack);
    layerBtns.appendChild(btnForward);
    layerBtns.appendChild(btnBackward);

    layerWrap.appendChild(layerBtns);
    panel.appendChild(layerWrap);

    if (type === "line") {
        addLabeledInput("dx (line width)", "number", widget.width, (v) => {
            widget.width = parseInt(v || "0", 10) || 0;
            renderCanvas();
        });
        addLabeledInput("dy (line height)", "number", widget.height, (v) => {
            widget.height = parseInt(v || "0", 10) || 0;
            renderCanvas();
        });
    } else {
        addLabeledInput("Width", "number", widget.width, (v) => {
            widget.width = parseInt(v || "0", 10) || 0;
            renderCanvas();
        });
        addLabeledInput("Height", "number", widget.height, (v) => {
            widget.height = parseInt(v || "0", 10) || 0;
            renderCanvas();
        });
    }

    if (type === "icon") {
        const fitWrap = document.createElement("div");
        fitWrap.className = "field";
        const fitLbl = document.createElement("div");
        fitLbl.className = "prop-label";
        fitLbl.textContent = "Fit icon to frame";
        const fitCb = document.createElement("input");
        fitCb.type = "checkbox";
        fitCb.checked = !!widget.props.fit_icon_to_frame;
        fitCb.addEventListener("change", () => {
            widget.props.fit_icon_to_frame = fitCb.checked;
            renderCanvas();
            scheduleSnippetUpdate();
        });
        fitWrap.appendChild(fitLbl);
        fitWrap.appendChild(fitCb);
        panel.appendChild(fitWrap);

        const iconPickerData = [
            // Battery icons
            { code: "F0079", name: "battery-outline" },
            { code: "F007A", name: "battery-10" },
            { code: "F007B", name: "battery-20" },
            { code: "F007C", name: "battery-30" },
            { code: "F007D", name: "battery-40" },
            { code: "F007E", name: "battery-50" },
            { code: "F007F", name: "battery-60" },
            { code: "F0080", name: "battery-70" },
            { code: "F0081", name: "battery-80" },
            { code: "F0082", name: "battery-90" },
            { code: "F0083", name: "battery-100" },
            // Weather icons
            { code: "F0591", name: "weather-sunny" },
            { code: "F0594", name: "weather-night-clear" },
            { code: "F0595", name: "weather-cloudy" },
            { code: "F0599", name: "weather-partly-cloudy" },
            { code: "F0596", name: "weather-rainy" },
            { code: "F0590", name: "weather-snowy" },
            { code: "F192D", name: "weather-snowy-heavy" },
            { code: "F192C", name: "weather-fog" },
            { code: "F067E", name: "weather-night" },
            { code: "F0598", name: "weather-lightning" },
            { code: "F0597", name: "weather-windy" },
            { code: "F0D9B", name: "cloud" },
            { code: "F06A1", name: "weather-pouring" },
            { code: "F0F2F", name: "weather-windy-variant" },
            { code: "F0F31", name: "weather-night-partly-cloudy" },
            { code: "F0F33", name: "weather-tornado" },
            { code: "F0593", name: "weather-hurricane" },
            { code: "F0E6E", name: "weather-hail" },
            { code: "F067F", name: "weather-lightning-rainy" },
            { code: "F0F30", name: "weather-dust" },
            { code: "F059D", name: "white-balance-sunny" },
            { code: "F0F32", name: "weather-snowy-rainy" },
            { code: "F0E6D", name: "weather-partly-rainy" },
            { code: "F0F34", name: "weather-sunset" },
            // Connectivity & Power
            { code: "F050F", name: "power-plug" },
            { code: "F043C", name: "wifi" },
            { code: "F15FA", name: "signal-variant" },
            // Sensors
            { code: "F058C", name: "brightness-percent" },
            { code: "F09A1", name: "thermometer-lines" },
            { code: "F058E", name: "water-percent" },
            { code: "F042B", name: "weather-thermometer" },
            { code: "F05D6", name: "thermometer" },
            { code: "F010C", name: "thermometer" },
            { code: "F0E8B", name: "home-thermometer" },
            { code: "F10BF", name: "temperature-celsius" },
            { code: "F10C0", name: "temperature-fahrenheit" },
            { code: "F058E", name: "water-percent" },
            { code: "F1049", name: "air-humidifier" },
            { code: "F073F", name: "air-conditioner" },
            { code: "F0E51", name: "radiator" },
            { code: "F0238", name: "fan" },
            { code: "F1025", name: "fan-off" },
            { code: "F0F2E", name: "weather-windy" },
            { code: "F0F3D", name: "weather-dust" },
            { code: "F1837", name: "air-filter" },
            { code: "F006E", name: "biohazard" },
            { code: "F050D", name: "fire" },
            { code: "F050F", name: "home" },
            { code: "F0510", name: "home-variant" },
            { code: "F06A1", name: "home-outline" },
            { code: "F15E6", name: "home-automation" },
            { code: "F0D8A", name: "home-floor-1" },
            { code: "F0D8B", name: "home-floor-2" },
            { code: "F0D8C", name: "home-floor-3" },
            { code: "F02E7", name: "bed" },
            { code: "F04B9", name: "sofa" },
            { code: "F070B", name: "door" },
            { code: "F081B", name: "door-open" },
            { code: "F081C", name: "door-closed" },
            { code: "F1359", name: "garage" },
            { code: "F135A", name: "garage-open" },
            { code: "F06B9", name: "gate" },
            { code: "F0E1E", name: "window-open" },
            { code: "F0E1D", name: "window-closed" },
            { code: "F1B3E", name: "window-shutter" },
            { code: "F1B3F", name: "window-shutter-open" },
            { code: "F0BCA", name: "stairs" },
            { code: "F07FD", name: "balcony" },
            { code: "F112A", name: "floor-plan" },
            { code: "F06A0", name: "roof" },
            { code: "F1A2F", name: "fence" },
            { code: "F099D", name: "car" },
            { code: "F008A", name: "lightbulb" },
            { code: "F0335", name: "lightbulb-on" },
            { code: "F0336", name: "lightbulb-off" },
            { code: "F06E8", name: "lightbulb-outline" },
            { code: "F1D9F", name: "ceiling-light" },
            { code: "F0769", name: "lamp" },
            { code: "F1433", name: "lamp-outline" },
            { code: "F17D3", name: "floor-lamp" },
            { code: "F095C", name: "desk-lamp" },
            { code: "F0F5B", name: "led-on" },
            { code: "F0F5C", name: "led-off" },
            { code: "F0F5D", name: "led-outline" },
            { code: "F1020", name: "led-strip" },
            { code: "F1021", name: "led-strip-variant" },
            { code: "F06C5", name: "lava-lamp" },
            { code: "F0769", name: "outdoor-lamp" },
            { code: "F1311", name: "wall-sconce" },
            { code: "F1312", name: "wall-sconce-flat" },
            { code: "F1313", name: "wall-sconce-round" },
            { code: "F1C5C", name: "coach-lamp" },
            { code: "F057F", name: "power" },
            { code: "F0580", name: "power-off" },
            { code: "F0425", name: "check" },
            { code: "F0156", name: "close" },
            { code: "F0C4E", name: "toggle-switch" },
            { code: "F0C4F", name: "toggle-switch-off" },
            { code: "F0493", name: "cog" },
            { code: "F08BB", name: "settings" },
            { code: "F0419", name: "menu" },
            { code: "F035C", name: "dots-vertical" },
            { code: "F01D9", name: "dots-horizontal" },
            { code: "F0142", name: "plus" },
            { code: "F0374", name: "minus" },
            { code: "F0140", name: "pencil" },
            { code: "F0A1A", name: "delete" },
            { code: "F0835", name: "refresh" },
            { code: "F02E6", name: "backup-restore" },
            { code: "F0193", name: "content-save" },
            { code: "F0C55", name: "tray-arrow-up" },
            { code: "F0C56", name: "tray-arrow-down" },
            { code: "F06C9", name: "lock" },
            { code: "F033E", name: "lock-open" },
            { code: "F0FC7", name: "shield-home" },
            { code: "F0780", name: "shield" },
            { code: "F0143", name: "bell" },
            { code: "F156C", name: "bell-alert" },
            { code: "F0029", name: "alarm-light" },
            { code: "F0024", name: "alert" },
            { code: "F0026", name: "alert-circle" },
            { code: "F02DC", name: "camera" },
            { code: "F1900", name: "cctv" },
            { code: "F07F5", name: "security" },
            { code: "F111C", name: "motion-sensor" },
            { code: "F0D39", name: "motion-sensor-off" },
            { code: "F0D95", name: "smoke-detector" },
            { code: "F11BD", name: "smoke-detector-alert" },
            { code: "F1A73", name: "fire-alert" },
            { code: "F1A74", name: "fire-extinguisher" },
            { code: "F11C6", name: "sprinkler" },
            { code: "F11C7", name: "sprinkler-variant" },
            { code: "F06E8", name: "play" },
            { code: "F03E4", name: "pause" },
            { code: "F04DB", name: "stop" },
            { code: "F04AE", name: "skip-next" },
            { code: "F04AD", name: "skip-previous" },
            { code: "F0EE0", name: "volume-high" },
            { code: "F075E", name: "volume-off" },
            { code: "F0765", name: "music" },
            { code: "F040A", name: "speaker" },
            { code: "F0794", name: "television" },
            { code: "F0322", name: "wifi" },
            { code: "F092F", name: "wifi-off" },
            { code: "F05A9", name: "bluetooth" },
            { code: "F0B43", name: "spotify" },
            { code: "F02C3", name: "youtube" },
            { code: "F11FC", name: "netflix" },
            { code: "F0057", name: "apple" },
            { code: "F040B", name: "cast" },
            { code: "F0239", name: "clock" },
            { code: "F0453", name: "calendar" },
            { code: "F08D0", name: "timer" },
            { code: "F0024", name: "alarm" },
            { code: "F14E4", name: "radio" },
            { code: "F036D", name: "microphone" },
            { code: "F036E", name: "microphone-off" },
            { code: "F0A48", name: "robot-vacuum" },
            { code: "F070D", name: "washing-machine" },
            { code: "F0232", name: "fridge" },
            { code: "F0CD6", name: "coffee-maker" },
            { code: "F1A42", name: "toaster" },
            { code: "F06D3", name: "microwave" },
            { code: "F0246", name: "stove" },
            { code: "F13E2", name: "oven" },
            { code: "F0EFB", name: "dishwasher" },
            { code: "F0A49", name: "vacuum" },
            { code: "F0663", name: "iron" },
            { code: "F1C48", name: "iron-outline" },
            { code: "F04B0", name: "blender" },
            { code: "F0EEF", name: "kettle" },
            { code: "F1006", name: "kettle-steam" },
            { code: "F02E3", name: "scale" },
            { code: "F0F8A", name: "scale-bathroom" },
            { code: "F11A1", name: "hair-dryer" },
            { code: "F11A2", name: "hair-dryer-outline" },
            { code: "F070C", name: "water-heater" },
            { code: "F1A6C", name: "water-pump" },
            { code: "F070E", name: "water-off" },
            { code: "F058A", name: "water" },
            { code: "F1436", name: "trash-can" },
            { code: "F0A79", name: "recycle" },
            { code: "F07E4", name: "battery" },
            { code: "F07E2", name: "battery-charging" },
            { code: "F12A1", name: "battery-50" },
            { code: "F0079", name: "battery-10" },
            { code: "F1A2E", name: "battery-high" },
            { code: "F007A", name: "battery-low" },
            { code: "F053D", name: "speedometer" },
            { code: "F0316", name: "gauge" },
            { code: "F07D1", name: "chart-line" },
            { code: "F01D7", name: "chart-bar" },
            { code: "F0127", name: "chart-donut" },
            { code: "F07E0", name: "chart-pie" },
            { code: "F1460", name: "chart-timeline" },
            { code: "F0E4C", name: "finance" },
            { code: "F0356", name: "currency-usd" },
            { code: "F033A", name: "currency-eur" },
            { code: "F02C1", name: "percent" },
            { code: "F0D7D", name: "poll" },
            { code: "F0125", name: "counter" },
            { code: "F1A5D", name: "meter-electric" },
            { code: "F0141", name: "arrow-up" },
            { code: "F0045", name: "arrow-down" },
            { code: "F004D", name: "arrow-left" },
            { code: "F0054", name: "arrow-right" },
            { code: "F0143", name: "chevron-up" },
            { code: "F0140", name: "chevron-down" },
            { code: "F0141", name: "chevron-left" },
            { code: "F0142", name: "chevron-right" },
            { code: "F035F", name: "menu-up" },
            { code: "F0360", name: "menu-down" },
            { code: "F035D", name: "menu-left" },
            { code: "F035E", name: "menu-right" },
            { code: "F02D7", name: "navigation" },
            { code: "F0E80", name: "compass" },
            { code: "F036C", name: "map" },
            { code: "F012C", name: "circle" },
            { code: "F0765", name: "record" },
            { code: "F0C92", name: "checkbox-marked" },
            { code: "F0C91", name: "checkbox-blank" },
            { code: "F0134", name: "radiobox-marked" },
            { code: "F0135", name: "radiobox-blank" },
            { code: "F0E1F", name: "star" },
            { code: "F0E20", name: "star-outline" },
            { code: "F029B", name: "heart" },
            { code: "F029C", name: "heart-outline" },
            { code: "F0765", name: "thumb-up" },
            { code: "F0766", name: "thumb-down" },
            { code: "F0028", name: "information" },
            { code: "F0625", name: "help-circle" },
            { code: "F05D6", name: "comment" },
            { code: "F043C", name: "home-assistant" },
            { code: "F07D0", name: "raspberry-pi" },
            { code: "F01BC", name: "code-tags" },
            { code: "F0A2F", name: "satellite-variant" },
            { code: "F06DC", name: "router-wireless" },
            { code: "F0317", name: "ethernet" },
            { code: "F0318", name: "cable-data" },
            { code: "F05A7", name: "webhook" },
            { code: "F0E03", name: "api" },
            { code: "F0DB3", name: "cloud-sync" },
            { code: "F02C5", name: "cloud" },
            { code: "F0DB2", name: "cloud-upload" },
            { code: "F0DB1", name: "cloud-download" },
            { code: "F019A", name: "download" },
            { code: "F0552", name: "upload" },
            { code: "F0625", name: "lan" },
            { code: "F0DA7", name: "ip-network" },
            { code: "F132D", name: "nas" },
            { code: "F0A0C", name: "server" },
            { code: "F0A0D", name: "server-network" },
            { code: "F0FB1", name: "air-purifier" },
            { code: "F104A", name: "humidifier" },
            { code: "F104B", name: "dehumidifier" },
            { code: "F181F", name: "air-horn" },
            { code: "F0697", name: "printer" },
            { code: "F042A", name: "scanner" },
            { code: "F0AF9", name: "shredder" },
            { code: "F0EF9", name: "paper-cut-vertical" },
            { code: "F06D0", name: "monitor" },
            { code: "F0322", name: "laptop" },
            { code: "F0CEE", name: "tablet" },
            { code: "F0C5F", name: "cellphone" },
            { code: "F0A5A", name: "phone" },
            { code: "F06E1", name: "keyboard" },
            { code: "F06E2", name: "mouse" },
            { code: "F0A5F", name: "remote" },
            { code: "F0A63", name: "gamepad" },
            { code: "F0A64", name: "controller-classic" },
            { code: "F1358", name: "glasses" },
            { code: "F0E31", name: "headphones" },
            { code: "F0E50", name: "sprinkler" },
            { code: "F0F5E", name: "water-pump" },
            { code: "F100A", name: "watering-can" },
            { code: "F0571", name: "flower" },
            { code: "F0C93", name: "tree" },
            { code: "F0C94", name: "palm-tree" },
            { code: "F0534", name: "grass" },
            { code: "F0D9F", name: "pine-tree" },
            { code: "F13ED", name: "grill" },
            { code: "F1468", name: "grill-outline" },
            { code: "F0232", name: "pool" },
            { code: "F0667", name: "hot-tub" },
            { code: "F1A3B", name: "patio-heater" },
            { code: "F17D1", name: "outdoor-lighting" },
            { code: "F0F1D", name: "mailbox" },
            { code: "F0A17", name: "solar-panel" },
            { code: "F0A18", name: "solar-panel-large" },
            { code: "F0A19", name: "solar-power" },
            { code: "F110D", name: "wind-turbine" },
            { code: "F0903", name: "transmission-tower" },
            { code: "F140B", name: "lightning-bolt" },
            { code: "F050E", name: "flash" },
            { code: "F0E9F", name: "flash-outline" },
            { code: "F0738", name: "ev-station" },
            { code: "F1873", name: "ev-plug-type1" },
            { code: "F1874", name: "ev-plug-type2" },
            { code: "F007F", name: "battery-charging-80" },
            { code: "F0580", name: "power-plug" },
            { code: "F06A5", name: "power-socket" },
            { code: "F1844", name: "power-socket-eu" },
            { code: "F1845", name: "power-socket-uk" },
            { code: "F1846", name: "power-socket-us" },
            { code: "F0C5B", name: "fuel" },
            { code: "F1344", name: "gas-station" },
            { code: "F1022", name: "propane-tank" },
            { code: "F0765", name: "heart-pulse" },
            { code: "F0A38", name: "medical-bag" },
            { code: "F0A39", name: "hospital" },
            { code: "F050A", name: "pill" },
            { code: "F0E2E", name: "thermometer-lines" },
            { code: "F1626", name: "face-mask" },
            { code: "F0B48", name: "allergy" },
            { code: "F0BF9", name: "sleep" },
            { code: "F0BFA", name: "sleep-off" },
            { code: "F06F7", name: "run" },
            { code: "F0B56", name: "walk" },
            { code: "F151F", name: "yoga" },
            { code: "F04D7", name: "dumbbell" },
            { code: "F1A91", name: "weight-kilogram" },
            { code: "F06F4", name: "scale-balance" },
            { code: "F0235", name: "file" },
            { code: "F0236", name: "file-document" },
            { code: "F0737", name: "folder" },
            { code: "F0770", name: "folder-open" },
            { code: "F0A0E", name: "briefcase" },
            { code: "F0238", name: "calendar-today" },
            { code: "F0ED0", name: "calendar-month" },
            { code: "F0C42", name: "note" },
            { code: "F0C43", name: "notebook" },
            { code: "F0C44", name: "clipboard" },
            { code: "F0765", name: "bookmark" },
            { code: "F0A2A", name: "tag" },
            { code: "F0765", name: "label" },
            { code: "F0239", name: "archive" },
            { code: "F013C", name: "email" },
            { code: "F036D", name: "message" },
            { code: "F036E", name: "chat" },
            { code: "F0EF5", name: "forum" },
            { code: "F0238", name: "send" },
            { code: "F11C8", name: "phone-ring" },
            { code: "F11C9", name: "phone-missed" },
            { code: "F05CB", name: "voicemail" },
            { code: "F06A2", name: "video" },
            { code: "F06A3", name: "video-off" },
            { code: "F03CB", name: "account" },
            { code: "F0806", name: "account-group" },
            { code: "F1502", name: "account-multiple" },
            { code: "F0765", name: "contacts" },
            { code: "F0765", name: "badge-account" },
            { code: "F0B7F", name: "human-greeting" }
        ];

        const iconPickerWrap = document.createElement("div");
        iconPickerWrap.className = "field";
        const iconPickerLbl = document.createElement("div");
        iconPickerLbl.className = "prop-label";
        iconPickerLbl.textContent = "Quick icon picker (visual preview)";

        const iconPickerSelect = document.createElement("select");
        iconPickerSelect.className = "select";
        iconPickerSelect.style.fontFamily = "MDI, monospace, system-ui";
        iconPickerSelect.style.fontSize = "16px";
        iconPickerSelect.style.lineHeight = "1.5";

        const placeholderOpt = document.createElement("option");
        placeholderOpt.value = "";
        placeholderOpt.textContent = "-- Select icon --";
        placeholderOpt.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
        iconPickerSelect.appendChild(placeholderOpt);

        iconPickerData.forEach(icon => {
            const opt = document.createElement("option");
            opt.value = icon.code;
            const cp = 0xf0000 + parseInt(icon.code.slice(1), 16);
            const glyph = String.fromCodePoint(cp);
            opt.textContent = glyph + "  " + icon.code;
            opt.style.fontFamily = "MDI, monospace, system-ui";
            iconPickerSelect.appendChild(opt);
        });

        const currentCode = (widget.props.code || "F0595").toUpperCase();
        const matchingIcon = iconPickerData.find(i => i.code === currentCode);
        if (matchingIcon) {
            iconPickerSelect.value = matchingIcon.code;
        }

        iconPickerSelect.addEventListener("change", () => {
            const selectedCode = iconPickerSelect.value;
            if (selectedCode) {
                widget.props.code = selectedCode;
                renderCanvas();
                renderPropertiesPanel();
                scheduleSnippetUpdate();
            }
        });

        iconPickerWrap.appendChild(iconPickerLbl);
        iconPickerWrap.appendChild(iconPickerSelect);
        panel.appendChild(iconPickerWrap);

        const moreIconsLink = document.createElement("div");
        moreIconsLink.style.fontSize = "12px";
        moreIconsLink.style.marginTop = "4px";
        moreIconsLink.style.marginBottom = "8px";
        moreIconsLink.style.color = "#666";
        moreIconsLink.innerHTML = 'Need more icons? Browse <a href="https://pictogrammers.com/library/mdi/icon/ " target="_blank" style="color: #03a9f4; text-decoration: none;">Pictogrammers MDI</a> and paste the Unicode below';
        panel.appendChild(moreIconsLink);

        addLabeledInput("MDI Unicode (Fxxxx)", "text", widget.props.code || "F0595", (v) => {
            const clean = (v || "").trim().toUpperCase().replace(/^0X/, "");
            if (/^F[0-9A-F]{4}$/i.test(clean)) {
                widget.props.code = clean;
            } else {
                widget.props.code = "F0595";
            }
            renderCanvas();
            scheduleSnippetUpdate();
        });

        addLabeledInput("Icon size (px)", "number", widget.props.size || 40, (v) => {
            let n = parseInt(v || "40", 10);
            if (Number.isNaN(n) || n < 8) n = 8;
            if (n > 260) n = 260;
            widget.props.size = n;
            renderCanvas();
            scheduleSnippetUpdate();
        });

        addSelect(
            "Font reference",
            widget.props.font_ref || "font_mdi_medium",
            ["font_mdi_medium", "font_mdi_large"],
            (val) => {
                widget.props.font_ref = val;
                renderCanvas();
                scheduleSnippetUpdate();
            }
        );

        addSelect("Icon color", widget.props.color || "black", ["black", "white", "gray"], (val) => {
            widget.props.color = val;
            renderCanvas();
            scheduleSnippetUpdate();
        });
    }

    if (type === "datetime") {
        addSelect(
            "Display format",
            widget.props.format || "time_date",
            ["time_date", "time_only", "date_only"],
            (val) => {
                widget.props.format = val;
                renderCanvas();
                scheduleSnippetUpdate();
            }
        );

        addLabeledInput("Time font size", "number", widget.props.time_font_size || 28, (v) => {
            widget.props.time_font_size = parseInt(v || "28", 10) || 28;
            renderCanvas();
            scheduleSnippetUpdate();
        });

        addLabeledInput("Date font size", "number", widget.props.date_font_size || 16, (v) => {
            widget.props.date_font_size = parseInt(v || "16", 10) || 16;
            renderCanvas();
            scheduleSnippetUpdate();
        });

        addSelect("Color", widget.props.color || "black", ["black", "white", "gray"], (val) => {
            widget.props.color = val;
            renderCanvas();
            scheduleSnippetUpdate();
        });
    }

    if (type === "progress_bar") {
        const entityWrap = document.createElement("div");
        entityWrap.className = "field";
        const entityLbl = document.createElement("div");
        entityLbl.className = "prop-label";
        entityLbl.textContent = "Entity ID (numeric sensor)";

        const entityRow = document.createElement("div");
        entityRow.style.display = "flex";
        entityRow.style.gap = "4px";

        const entityInput = document.createElement("input");
        entityInput.className = "prop-input";
        entityInput.type = "text";
        entityInput.value = widget.entity_id || "";
        entityInput.style.flex = "1";
        entityInput.addEventListener("input", () => {
            widget.entity_id = entityInput.value;
            if (hasHaBackend() && Object.keys(entityStatesCache).length === 0) {
                fetchEntityStates();
            }
            renderCanvas();
            scheduleSnippetUpdate();
        });

        const pickerBtn = document.createElement("button");
        pickerBtn.className = "btn btn-secondary";
        pickerBtn.textContent = "⋮⋮⋮";
        pickerBtn.style.padding = "5px 8px";
        pickerBtn.style.fontSize = "10px";
        pickerBtn.type = "button";
        pickerBtn.title = "Pick from Home Assistant entities";
        pickerBtn.addEventListener("click", () => {
            openEntityPickerForWidget(widget, entityInput);
        });

        entityRow.appendChild(entityInput);
        entityRow.appendChild(pickerBtn);
        entityWrap.appendChild(entityLbl);
        entityWrap.appendChild(entityRow);
        panel.appendChild(entityWrap);

        const localWrap = document.createElement("div");
        localWrap.className = "field";
        const localLbl = document.createElement("div");
        localLbl.className = "prop-label";
        localLbl.textContent = "Local / On-Device Sensor";
        const localCb = document.createElement("input");
        localCb.type = "checkbox";
        localCb.checked = !!widget.props.is_local_sensor;
        localCb.addEventListener("change", () => {
            widget.props.is_local_sensor = localCb.checked;
            scheduleSnippetUpdate();
        });
        localWrap.appendChild(localLbl);
        localWrap.appendChild(localCb);
        panel.appendChild(localWrap);

        addLabeledInput("Label (optional)", "text", widget.title || "", (v) => {
            widget.title = v;
            renderCanvas();
            scheduleSnippetUpdate();
        });

        const showLabelWrap = document.createElement("div");
        showLabelWrap.className = "field";
        const showLabelLbl = document.createElement("div");
        showLabelLbl.className = "prop-label";
        showLabelLbl.textContent = "Show label row";
        const showLabelCb = document.createElement("input");
        showLabelCb.type = "checkbox";
        showLabelCb.checked = widget.props.show_label !== false;
        showLabelCb.addEventListener("change", () => {
            widget.props.show_label = showLabelCb.checked;
            renderCanvas();
            scheduleSnippetUpdate();
        });
        showLabelWrap.appendChild(showLabelLbl);
        showLabelWrap.appendChild(showLabelCb);
        panel.appendChild(showLabelWrap);

        const showPctWrap = document.createElement("div");
        showPctWrap.className = "field";
        const showPctLbl = document.createElement("div");
        showPctLbl.className = "prop-label";
        showPctLbl.textContent = "Show percentage";
        const showPctCb = document.createElement("input");
        showPctCb.type = "checkbox";
        showPctCb.checked = widget.props.show_percentage !== false;
        showPctCb.addEventListener("change", () => {
            widget.props.show_percentage = showPctCb.checked;
            renderCanvas();
            scheduleSnippetUpdate();
        });
        showPctWrap.appendChild(showPctCb);
        panel.appendChild(showPctWrap);

        addSelect("Line color", widget.props.color || "black", ["black", "white", "gray"], (val) => {
            widget.props.color = val;
            renderCanvas();
            scheduleSnippetUpdate();
        });
    }

    if (type === "graph") {
        const infoWrap = document.createElement("div");
        infoWrap.className = "field";
        infoWrap.style.fontSize = "9px";
        infoWrap.style.color = "var(--muted)";
        infoWrap.style.marginBottom = "8px";
        infoWrap.innerHTML = "📊 ESPHome graph component<br/>Plots sensor history over time";
        panel.appendChild(infoWrap);

        // Entity ID with picker
        const entityWrap = document.createElement("div");
        entityWrap.className = "field";
        const entityLbl = document.createElement("div");
        entityLbl.className = "prop-label";
        entityLbl.textContent = "Sensor Entity ID";

        const entityRow = document.createElement("div");
        entityRow.style.display = "flex";
        entityRow.style.gap = "4px";

        const entityInput = document.createElement("input");
        entityInput.className = "prop-input";
        entityInput.type = "text";
        entityInput.value = widget.entity_id || "";
        entityInput.style.flex = "1";
        entityInput.addEventListener("input", () => {
            widget.entity_id = entityInput.value;
            renderCanvas();
            scheduleSnippetUpdate();
        });

        const pickerBtn = document.createElement("button");
        pickerBtn.className = "btn btn-secondary";
        pickerBtn.textContent = "⋮⋮⋮";
        pickerBtn.style.padding = "5px 8px";
        pickerBtn.style.fontSize = "10px";
        pickerBtn.type = "button";
        pickerBtn.title = "Pick from Home Assistant entities";
        pickerBtn.addEventListener("click", () => {
            openEntityPickerForWidget(widget, entityInput);
        });

        entityRow.appendChild(entityInput);
        entityRow.appendChild(pickerBtn);
        entityWrap.appendChild(entityLbl);
        entityWrap.appendChild(entityRow);
        panel.appendChild(entityWrap);

        const localWrap = document.createElement("div");
        localWrap.className = "field";
        const localLbl = document.createElement("div");
        localLbl.className = "prop-label";
        localLbl.textContent = "Local / On-Device Sensor";
        const localCb = document.createElement("input");
        localCb.type = "checkbox";
        localCb.checked = !!widget.props.is_local_sensor;
        localCb.addEventListener("change", () => {
            widget.props.is_local_sensor = localCb.checked;
            scheduleSnippetUpdate();
        });
        localWrap.appendChild(localLbl);
        localWrap.appendChild(localCb);
        localWrap.appendChild(localLbl);
        localWrap.appendChild(localCb);
        panel.appendChild(localWrap);

        // Label / Title
        addLabeledInput("Label / Title (optional)", "text", widget.title || "", (v) => {
            widget.title = v;
            renderCanvas();
            scheduleSnippetUpdate();
        });

        // Duration
        addSelect("Duration", widget.props.duration || "1h",
            ["1h", "3h", "6h", "12h", "24h", "2d", "3d", "7d", "14d", "30d"], (val) => {
                widget.props.duration = val;
                scheduleSnippetUpdate();
            });

        // Grid settings
        const gridHeader = document.createElement("div");
        gridHeader.className = "prop-label";
        gridHeader.style.marginTop = "12px";
        gridHeader.style.marginBottom = "4px";
        gridHeader.textContent = "Grid Settings";
        panel.appendChild(gridHeader);

        // X Grid with Presets
        const xGridOptions = ["", "1min", "5min", "10min", "15min", "30min", "1h", "6h", "12h", "24h"];
        const xGridWrap = document.createElement("div");
        xGridWrap.className = "field";
        const xGridLbl = document.createElement("div");
        xGridLbl.className = "prop-label";
        xGridLbl.textContent = "X Grid (Time per division)";
        xGridWrap.appendChild(xGridLbl);

        const xGridRow = document.createElement("div");
        xGridRow.style.display = "flex";
        xGridRow.style.gap = "4px";

        const xGridInput = document.createElement("input");
        xGridInput.className = "prop-input";
        xGridInput.type = "text";
        xGridInput.value = widget.props.x_grid || "";
        xGridInput.placeholder = "e.g. 10min";
        xGridInput.style.flex = "1";
        xGridInput.addEventListener("input", () => {
            widget.props.x_grid = xGridInput.value;
            renderCanvas(); // Re-render for grid preview
            scheduleSnippetUpdate();
        });

        const xGridSel = document.createElement("select");
        xGridSel.className = "prop-input";
        xGridSel.style.width = "20px"; // Small dropdown arrow
        xGridSel.title = "Select Preset";
        xGridOptions.forEach(opt => {
            const o = document.createElement("option");
            o.value = opt;
            o.textContent = opt || "Custom";
            xGridSel.appendChild(o);
        });
        xGridSel.addEventListener("change", () => {
            if (xGridSel.value) {
                xGridInput.value = xGridSel.value;
                widget.props.x_grid = xGridSel.value;
                renderCanvas();
                scheduleSnippetUpdate();
            }
            xGridSel.value = ""; // Reset so we can select same value again
        });

        xGridRow.appendChild(xGridInput);
        xGridRow.appendChild(xGridSel);
        xGridWrap.appendChild(xGridRow);
        panel.appendChild(xGridWrap);

        // Y Grid with Presets
        const yGridOptions = ["", "0.1", "0.5", "1.0", "2.0", "5.0", "10.0", "20.0", "50.0", "100.0"];
        const yGridWrap = document.createElement("div");
        yGridWrap.className = "field";
        const yGridLbl = document.createElement("div");
        yGridLbl.className = "prop-label";
        yGridLbl.textContent = "Y Grid (Units per division)";
        yGridWrap.appendChild(yGridLbl);

        const yGridRow = document.createElement("div");
        yGridRow.style.display = "flex";
        yGridRow.style.gap = "4px";

        const yGridInput = document.createElement("input");
        yGridInput.className = "prop-input";
        yGridInput.type = "text";
        yGridInput.value = widget.props.y_grid || "";
        yGridInput.placeholder = "e.g. 1.0";
        yGridInput.style.flex = "1";
        yGridInput.addEventListener("input", () => {
            widget.props.y_grid = yGridInput.value;
            renderCanvas(); // Re-render for grid preview
            scheduleSnippetUpdate();
        });

        const yGridSel = document.createElement("select");
        yGridSel.className = "prop-input";
        yGridSel.style.width = "20px";
        yGridSel.title = "Select Preset";
        yGridOptions.forEach(opt => {
            const o = document.createElement("option");
            o.value = opt;
            o.textContent = opt || "Custom";
            yGridSel.appendChild(o);
        });
        yGridSel.addEventListener("change", () => {
            if (yGridSel.value) {
                yGridInput.value = yGridSel.value;
                widget.props.y_grid = yGridSel.value;
                renderCanvas();
                scheduleSnippetUpdate();
            }
            yGridSel.value = "";
        });

        yGridRow.appendChild(yGridInput);
        yGridRow.appendChild(yGridSel);
        yGridWrap.appendChild(yGridRow);
        panel.appendChild(yGridWrap);

        // Border toggle
        const borderWrap = document.createElement("div");
        borderWrap.className = "field";
        const borderLbl = document.createElement("div");
        borderLbl.className = "prop-label";
        borderLbl.textContent = "Show border";
        const borderCb = document.createElement("input");
        borderCb.type = "checkbox";
        borderCb.checked = widget.props.border !== false;
        borderCb.addEventListener("change", () => {
            widget.props.border = borderCb.checked;
            renderCanvas();
            scheduleSnippetUpdate();
        });
        borderWrap.appendChild(borderLbl);
        borderWrap.appendChild(borderCb);
        panel.appendChild(borderWrap);

        // Line styling
        const lineHeader = document.createElement("div");
        lineHeader.className = "prop-label";
        lineHeader.style.marginTop = "12px";
        lineHeader.style.marginBottom = "4px";
        lineHeader.textContent = "Line Styling";
        panel.appendChild(lineHeader);

        addSelect("Line type", widget.props.line_type || "SOLID",
            ["SOLID", "DASHED", "DOTTED"], (val) => {
                widget.props.line_type = val;
                scheduleSnippetUpdate();
            });

        addLabeledInput("Line thickness (px)", "number", widget.props.line_thickness || 3, (v) => {
            widget.props.line_thickness = parseInt(v || "3", 10) || 3;
            scheduleSnippetUpdate();
        });

        const contWrap = document.createElement("div");
        contWrap.className = "field";
        const contLbl = document.createElement("div");
        contLbl.className = "prop-label";
        contLbl.textContent = "Continuous line";
        const contCb = document.createElement("input");
        contCb.type = "checkbox";
        contCb.checked = !!widget.props.continuous;
        contCb.addEventListener("change", () => {
            widget.props.continuous = contCb.checked;
            scheduleSnippetUpdate();
        });
        contWrap.appendChild(contLbl);
        contWrap.appendChild(contCb);
        panel.appendChild(contWrap);

        addSelect("Color", widget.props.color || "black", ["black", "white", "gray"], (val) => {
            widget.props.color = val;
            renderCanvas();
            scheduleSnippetUpdate();
        });

        // Y-axis range
        const rangeHeader = document.createElement("div");
        rangeHeader.className = "prop-label";
        rangeHeader.style.marginTop = "12px";
        rangeHeader.style.marginBottom = "4px";
        rangeHeader.textContent = "Y-Axis Range (Optional)";
        panel.appendChild(rangeHeader);

        addLabeledInput("Min value", "text", widget.props.min_value || "", (v) => {
            widget.props.min_value = v;
            scheduleSnippetUpdate();
        });

        addLabeledInput("Max value", "text", widget.props.max_value || "", (v) => {
            widget.props.max_value = v;
            scheduleSnippetUpdate();
        });

        addLabeledInput("Min range", "text", widget.props.min_range || "", (v) => {
            widget.props.min_range = v;
            scheduleSnippetUpdate();
        });

        addLabeledInput("Max range", "text", widget.props.max_range || "", (v) => {
            widget.props.max_range = v;
            scheduleSnippetUpdate();
        });
    }

    if (type === "image") {
        const helpWrap = document.createElement("div");
        helpWrap.className = "field";
        helpWrap.style.fontSize = "9px";
        helpWrap.style.color = "var(--muted)";
        helpWrap.style.marginBottom = "8px";
        invertCb.type = "checkbox";
        invertCb.checked = !!widget.props.invert;
        invertCb.addEventListener("change", () => {
            widget.props.invert = invertCb.checked;
            renderCanvas();
            scheduleSnippetUpdate();
        });
        invertWrap.appendChild(invertLbl);
        invertWrap.appendChild(invertCb);
        panel.appendChild(invertWrap);

        const fillWrap = document.createElement("div");
        fillWrap.className = "field";
        fillWrap.style.marginTop = "12px";

        const isFullScreen = (widget.x === 0 && widget.y === 0 &&
            widget.width === CANVAS_WIDTH &&
            widget.height === CANVAS_HEIGHT);

        const fillBtn = document.createElement("button");
        fillBtn.className = "btn " + (isFullScreen ? "btn-primary" : "btn-secondary") + " btn-full";
        fillBtn.textContent = isFullScreen ? "✓ Full Screen (click to restore)" : "⛶ Fill Screen";
        fillBtn.type = "button";
        fillBtn.title = isFullScreen ? "Restore to previous size" : "Resize image to fill entire screen";
        fillBtn.addEventListener("click", () => {
            if (widget.x === 0 && widget.y === 0 &&
                widget.width === CANVAS_WIDTH &&
                widget.height === CANVAS_HEIGHT) {
                widget.x = 50;
                widget.y = 50;
                widget.width = 200;
                widget.height = 150;
            } else {
                widget.x = 0;
                widget.y = 0;
                widget.width = CANVAS_WIDTH;
                widget.height = CANVAS_HEIGHT;
            }
            renderCanvas();
            renderPropertiesPanel();
            scheduleSnippetUpdate();
        });
        fillWrap.appendChild(fillBtn);
        panel.appendChild(fillWrap);
    }

    if (type === "online_image") {
        const helpWrap = document.createElement("div");
        helpWrap.className = "field";
        helpWrap.style.fontSize = "9px";
        helpWrap.style.color = "var(--muted)";
        helpWrap.style.marginBottom = "8px";
        helpWrap.innerHTML = "💡 Fetch remote images dynamically (Puppet support):<br/>" +
            "<code style='background:#f0f0f0;padding:2px 4px;border-radius:2px;'>https://example.com/camera/snapshot.jpg </code><br/>" +
            "<span style='color:#4a9eff;'>ℹ️ Images are downloaded at specified intervals</span>";
        panel.appendChild(helpWrap);

        addLabeledInput("Remote URL", "text", widget.props.url || "", (v) => {
            widget.props.url = v;
            renderCanvas();
            scheduleSnippetUpdate();
        });

        addLabeledInput("Update interval (seconds)", "number", widget.props.interval_s || 300, (v) => {
            widget.props.interval_s = parseInt(v, 10) || 300;
            renderCanvas();
            scheduleSnippetUpdate();
        });
    }

    if (type === "datetime") {
        addSelect(
            "Display format",
            widget.props.format || "time_date",
            ["time_date", "time_only", "date_only"],
            (val) => {
                widget.props.format = val;
                renderCanvas();
                scheduleSnippetUpdate();
            }
        );

        addLabeledInput("Time font size", "number", widget.props.time_font_size || 28, (v) => {
            widget.props.time_font_size = parseInt(v || "28", 10) || 28;
            renderCanvas();
            scheduleSnippetUpdate();
        });

        addLabeledInput("Date font size", "number", widget.props.date_font_size || 16, (v) => {
            widget.props.date_font_size = parseInt(v || "16", 10) || 16;
            renderCanvas();
            scheduleSnippetUpdate();
        });

        addSelect("Color", widget.props.color || "black", ["black", "white", "gray"], (val) => {
            widget.props.color = val;
            renderCanvas();
            scheduleSnippetUpdate();
        });
    }

    if (type === "progress_bar") {
        const entityWrap = document.createElement("div");
        entityWrap.className = "field";
        const entityLbl = document.createElement("div");
        entityLbl.className = "prop-label";
        entityLbl.textContent = "Entity ID (numeric sensor)";

        const entityRow = document.createElement("div");
        entityRow.style.display = "flex";
        entityRow.style.gap = "4px";

        const entityInput = document.createElement("input");
        entityInput.className = "prop-input";
        entityInput.type = "text";
        entityInput.value = widget.entity_id || "";
        entityInput.style.flex = "1";
        entityInput.addEventListener("input", () => {
            widget.entity_id = entityInput.value;
            if (hasHaBackend() && Object.keys(entityStatesCache).length === 0) {
                fetchEntityStates();
            }
            renderCanvas();
            scheduleSnippetUpdate();
        });

        const pickerBtn = document.createElement("button");
        pickerBtn.className = "btn btn-secondary";
        pickerBtn.textContent = "⋮⋮⋮";
        pickerBtn.style.padding = "5px 8px";
        pickerBtn.style.fontSize = "10px";
        pickerBtn.type = "button";
        pickerBtn.title = "Pick from Home Assistant entities";
        pickerBtn.addEventListener("click", () => {
            openEntityPickerForWidget(widget, entityInput);
        });

        entityRow.appendChild(entityInput);
        entityRow.appendChild(pickerBtn);
        entityWrap.appendChild(entityLbl);
        entityWrap.appendChild(entityRow);
        panel.appendChild(entityWrap);

        addLabeledInput("Label (optional)", "text", widget.title || "", (v) => {
            widget.title = v;
            renderCanvas();
            scheduleSnippetUpdate();
        });

        const showLabelWrap = document.createElement("div");
        showLabelWrap.className = "field";
        const showLabelLbl = document.createElement("div");
        showLabelLbl.className = "prop-label";
        showLabelLbl.textContent = "Show label row";
        const showLabelCb = document.createElement("input");
        showLabelCb.type = "checkbox";
        showLabelCb.checked = widget.props.show_label !== false;
        showLabelCb.addEventListener("change", () => {
            widget.props.show_label = showLabelCb.checked;
            renderCanvas();
            scheduleSnippetUpdate();
        });
        showLabelWrap.appendChild(showLabelLbl);
        showLabelWrap.appendChild(showLabelCb);
        panel.appendChild(showLabelWrap);

        const showPctWrap = document.createElement("div");
        showPctWrap.className = "field";
        const showPctLbl = document.createElement("div");
        showPctLbl.className = "prop-label";
        showPctLbl.textContent = "Show percentage";
        const showPctCb = document.createElement("input");
        showPctCb.type = "checkbox";
        showPctCb.checked = widget.props.show_percentage !== false;
        showPctCb.addEventListener("change", () => {
            widget.props.show_percentage = showPctCb.checked;
            renderCanvas();
            scheduleSnippetUpdate();
        });
        showPctWrap.appendChild(showPctLbl);
        showPctWrap.appendChild(showPctCb);
        panel.appendChild(showPctWrap);

        addLabeledInput("Bar height (px)", "number", widget.props.bar_height || 15, (v) => {
            widget.props.bar_height = parseInt(v || "15", 10) || 15;
            renderCanvas();
            scheduleSnippetUpdate();
        });

        addLabeledInput("Border width (px)", "number", widget.props.border_width || 1, (v) => {
            widget.props.border_width = parseInt(v || "1", 10) || 1;
            renderCanvas();
            scheduleSnippetUpdate();
        });

        addSelect("Color", widget.props.color || "black", ["black", "white", "gray"], (val) => {
            widget.props.color = val;
            renderCanvas();
            scheduleSnippetUpdate();
        });
    }

    if (type === "battery_icon") {
        const entityWrap = document.createElement("div");
        entityWrap.className = "field";
        const entityLbl = document.createElement("div");
        entityLbl.className = "prop-label";
        entityLbl.textContent = "Battery Entity ID";

        const entityRow = document.createElement("div");
        entityRow.style.display = "flex";
        entityRow.style.gap = "4px";

        const entityInput = document.createElement("input");
        entityInput.className = "prop-input";
        entityInput.type = "text";
        entityInput.value = widget.entity_id || "";
        entityInput.style.flex = "1";
        entityInput.addEventListener("input", () => {
            widget.entity_id = entityInput.value;
            if (hasHaBackend() && Object.keys(entityStatesCache).length === 0) {
                fetchEntityStates();
            }
            renderCanvas();
            scheduleSnippetUpdate();
        });

        const pickerBtn = document.createElement("button");
        pickerBtn.className = "btn btn-secondary";
        pickerBtn.textContent = "⋮⋮⋮";
        pickerBtn.style.padding = "5px 8px";
        pickerBtn.style.fontSize = "10px";
        pickerBtn.type = "button";
        pickerBtn.title = "Pick from Home Assistant entities";
        pickerBtn.addEventListener("click", () => {
            openEntityPickerForWidget(widget, entityInput);
        });

        entityRow.appendChild(entityInput);
        entityRow.appendChild(pickerBtn);
        entityWrap.appendChild(entityLbl);
        entityWrap.appendChild(entityRow);
        panel.appendChild(entityWrap);

        const localWrap = document.createElement("div");
        localWrap.className = "field";
        const localLbl = document.createElement("div");
        localLbl.className = "prop-label";
        localLbl.textContent = "Local / On-Device Sensor";
        const localCb = document.createElement("input");
        localCb.type = "checkbox";
        localCb.checked = !!widget.props.is_local_sensor;
        localCb.addEventListener("change", () => {
            widget.props.is_local_sensor = localCb.checked;
            scheduleSnippetUpdate();
        });
        localWrap.appendChild(localLbl);
        localWrap.appendChild(localCb);
        panel.appendChild(localWrap);

        addLabeledInput("Icon size (px)", "number", widget.props.size || 48, (v) => {
            let n = parseInt(v || "48", 10);
            if (Number.isNaN(n) || n < 16) n = 16;
            if (n > 200) n = 200;
            widget.props.size = n;
            renderCanvas();
            scheduleSnippetUpdate();
        });

        addSelect("Color", widget.props.color || "black", ["black", "white", "gray"], (val) => {
            widget.props.color = val;
            renderCanvas();
            scheduleSnippetUpdate();
        });
    }

    if (type === "weather_icon") {
        const entityWrap = document.createElement("div");
        entityWrap.className = "field";
        const entityLbl = document.createElement("div");
        entityLbl.className = "prop-label";
        entityLbl.textContent = "Weather Entity ID";

        const entityRow = document.createElement("div");
        entityRow.style.display = "flex";
        entityRow.style.gap = "4px";

        const entityInput = document.createElement("input");
        entityInput.className = "prop-input";
        entityInput.type = "text";
        entityInput.value = widget.entity_id || "";
        entityInput.style.flex = "1";
        entityInput.addEventListener("input", () => {
            widget.entity_id = entityInput.value;
            if (hasHaBackend() && Object.keys(entityStatesCache).length === 0) {
                fetchEntityStates();
            }
            renderCanvas();
            scheduleSnippetUpdate();
        });

        const pickerBtn = document.createElement("button");
        pickerBtn.className = "btn btn-secondary";
        pickerBtn.textContent = "⋮⋮⋮";
        pickerBtn.style.padding = "5px 8px";
        pickerBtn.style.fontSize = "10px";
        pickerBtn.type = "button";
        pickerBtn.title = "Pick from Home Assistant entities";
        pickerBtn.addEventListener("click", () => {
            openEntityPickerForWidget(widget, entityInput);
        });

        entityRow.appendChild(entityInput);
        entityRow.appendChild(pickerBtn);
        entityWrap.appendChild(entityLbl);
        entityWrap.appendChild(entityRow);
        panel.appendChild(entityWrap);

        addLabeledInput("Icon size (px)", "number", widget.props.size || 48, (v) => {
            let n = parseInt(v || "48", 10);
            if (Number.isNaN(n) || n < 16) n = 16;
            if (n > 200) n = 200;
            widget.props.size = n;
            renderCanvas();
            scheduleSnippetUpdate();
        });

        addSelect("Color", widget.props.color || "black", ["black", "white", "gray"], (val) => {
            widget.props.color = val;
            renderCanvas();
            scheduleSnippetUpdate();
        });
    }

    if (["text", "sensor_text"].includes(type)) {
        if (type === "text") {
            addLabeledInput("Text", "text", widget.props.text || "", (v) => {
                widget.props.text = v;
                renderCanvas();
                scheduleSnippetUpdate();
            });
        }
        if (type === "sensor_text") {
            const entityWrap = document.createElement("div");
            entityWrap.className = "field";
            const entityLbl = document.createElement("div");
            entityLbl.className = "prop-label";
            entityLbl.textContent = "Entity ID";

            const entityRow = document.createElement("div");
            entityRow.style.display = "flex";
            entityRow.style.gap = "4px";

            const entityInput = document.createElement("input");
            entityInput.className = "prop-input";
            entityInput.type = "text";
            entityInput.value = widget.entity_id || "";
            entityInput.style.flex = "1";
            entityInput.addEventListener("input", () => {
                widget.entity_id = entityInput.value;
                if (hasHaBackend() && Object.keys(entityStatesCache).length === 0) {
                    fetchEntityStates();
                }
                renderCanvas();
                scheduleSnippetUpdate();
            });

            const pickerBtn = document.createElement("button");
            pickerBtn.className = "btn btn-secondary";
            pickerBtn.textContent = "⋮⋮⋮";
            pickerBtn.style.padding = "5px 8px";
            pickerBtn.style.fontSize = "10px";
            pickerBtn.type = "button";
            pickerBtn.title = "Pick from Home Assistant entities";
            pickerBtn.addEventListener("click", () => {
                openEntityPickerForWidget(widget, entityInput);
            });

            entityRow.appendChild(entityInput);
            entityRow.appendChild(pickerBtn);
            entityWrap.appendChild(entityLbl);
            entityWrap.appendChild(entityRow);
            panel.appendChild(entityWrap);

            const localWrap = document.createElement("div");
            localWrap.className = "field";
            const localLbl = document.createElement("div");
            localLbl.className = "prop-label";
            localLbl.textContent = "Local / On-Device Sensor";
            const localCb = document.createElement("input");
            localCb.type = "checkbox";
            localCb.checked = !!widget.props.is_local_sensor;
            localCb.addEventListener("change", () => {
                widget.props.is_local_sensor = localCb.checked;
                scheduleSnippetUpdate();
            });
            localWrap.appendChild(localLbl);
            localWrap.appendChild(localCb);
            panel.appendChild(localWrap);

            addLabeledInput("Label (leave empty for value only)", "text", widget.title || "", (v) => {
                widget.title = v;
                renderCanvas();
                scheduleSnippetUpdate();
            });

            addSelect(
                "Display format",
                widget.props.value_format || "value_only",
                ["value_only", "label_value", "label_newline_value"],
                (val) => {
                    widget.props.value_format = val;
                    renderCanvas();
                    scheduleSnippetUpdate();
                }
            );

            addLabeledInput("Label font size", "number", widget.props.label_font_size || 14, (v) => {
                widget.props.label_font_size = parseInt(v || "14", 10) || 14;
                renderCanvas();
                scheduleSnippetUpdate();
            });

            addLabeledInput("Value font size", "number", widget.props.value_font_size || 20, (v) => {
                widget.props.value_font_size = parseInt(v || "20", 10) || 20;
                renderCanvas();
                scheduleSnippetUpdate();
            });

            addLabeledInput("Precision (decimals)", "number", widget.props.precision != null ? widget.props.precision : -1, (v) => {
                widget.props.precision = parseInt(v || "-1", 10);
                renderCanvas();
                scheduleSnippetUpdate();
            });
        }

        if (type === "text") {
            const fontOptions = [
                "Roboto", "Inter", "Open Sans", "Lato", "Montserrat",
                "Poppins", "Raleway", "Roboto Mono", "Ubuntu", "Nunito",
                "Playfair Display", "Merriweather", "Work Sans", "Source Sans Pro", "Quicksand",
                "Custom..."
            ];

            const currentFont = widget.props.font_family || "Roboto";
            const isCustom = !fontOptions.slice(0, -1).includes(currentFont);

            addSelect("Font family", isCustom ? "Custom..." : currentFont, fontOptions, (val) => {
                if (val !== "Custom...") {
                    widget.props.font_family = val;
                    widget.props.custom_font_family = "";
                    renderCanvas();
                    renderPropertiesPanel();
                    scheduleSnippetUpdate();
                } else {
                    // Set to Custom... to trigger the input field
                    widget.props.font_family = "Custom...";
                    renderPropertiesPanel();
                }
            });

            // Show custom font input if "Custom..." is selected or if font is not in list
            if (isCustom || widget.props.font_family === "Custom...") {
                const customWrap = document.createElement("div");
                customWrap.className = "field";
                customWrap.style.marginTop = "-8px";

                const customLbl = document.createElement("div");
                customLbl.className = "prop-label";
                customLbl.textContent = "Custom Google Font";

                const customInput = document.createElement("input");
                customInput.className = "prop-input";
                customInput.type = "text";
                customInput.placeholder = "e.g., Pacifico, Dancing Script";
                customInput.value = (widget.props.font_family === "Custom..." ? "" : (isCustom ? currentFont : (widget.props.custom_font_family || "")));

                customInput.addEventListener("input", () => {
                    const val = customInput.value.trim();
                    widget.props.font_family = val || "Roboto";
                    widget.props.custom_font_family = val;
                    renderCanvas();
                    scheduleSnippetUpdate();
                });

                customWrap.appendChild(customLbl);
                customWrap.appendChild(customInput);
                panel.appendChild(customWrap);

                const customHint = document.createElement("div");
                customHint.style.fontSize = "9px";
                customHint.style.color = "#666";
                customHint.style.marginTop = "2px";
                customHint.style.marginBottom = "8px";
                customHint.innerHTML = 'Browse <a href="https://fonts.google.com" target="_blank" style="color: #52c7ea">fonts.google.com</a> (no preview, but generates correct YAML)';
                panel.appendChild(customHint);
            }

            addLabeledInput("Font size", "number", widget.props.font_size || 16, (v) => {
                widget.props.font_size = parseInt(v || "16", 10) || 16;
                renderCanvas();
                scheduleSnippetUpdate();
            });

            addSelect(
                "Font weight",
                String(widget.props.font_weight || 400),
                ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
                (val) => {
                    widget.props.font_weight = parseInt(val, 10);
                    renderCanvas();
                    scheduleSnippetUpdate();
                }
            );

            const italicWrap = document.createElement("div");
            italicWrap.className = "field";
            const italicLbl = document.createElement("div");
            italicLbl.className = "prop-label";
            italicLbl.textContent = "Italic";
            const italicCb = document.createElement("input");
            italicCb.type = "checkbox";
            italicCb.checked = !!widget.props.italic;
            italicCb.addEventListener("change", () => {
                widget.props.italic = italicCb.checked;
                renderCanvas();
                scheduleSnippetUpdate();
            });
            italicWrap.appendChild(italicLbl);
            italicWrap.appendChild(italicCb);
            panel.appendChild(italicWrap);

            addSelect(
                "BPP (anti-aliasing)",
                String(widget.props.bpp || 1),
                ["1", "2", "4", "8"],
                (val) => {
                    widget.props.bpp = parseInt(val, 10);
                    scheduleSnippetUpdate();
                }
            );

            const bppInfo = document.createElement("div");
            bppInfo.style.fontSize = "9px";
            bppInfo.style.color = "#666";
            bppInfo.style.marginTop = "-8px";
            bppInfo.style.marginBottom = "8px";
            bppInfo.textContent = "1=no AA, 2=4 levels, 4=16 levels, 8=256 levels (smoother but larger)";
            panel.appendChild(bppInfo);
        }

        if (type === "sensor_text") {
            const fontOptions = [
                "Roboto", "Inter", "Open Sans", "Lato", "Montserrat",
                "Poppins", "Raleway", "Roboto Mono", "Ubuntu", "Nunito",
                "Playfair Display", "Merriweather", "Work Sans", "Source Sans Pro", "Quicksand",
                "Custom..."
            ];

            const currentFont = widget.props.font_family || "Roboto";
            const isCustom = !fontOptions.slice(0, -1).includes(currentFont);

            addSelect("Font family", isCustom ? "Custom..." : currentFont, fontOptions, (val) => {
                if (val !== "Custom...") {
                    widget.props.font_family = val;
                    widget.props.custom_font_family = "";
                    renderCanvas();
                    renderPropertiesPanel();
                    scheduleSnippetUpdate();
                } else {
                    widget.props.font_family = "Custom...";
                    renderPropertiesPanel();
                }
            });

            if (isCustom || widget.props.font_family === "Custom...") {
                const customWrap = document.createElement("div");
                customWrap.className = "field";
                customWrap.style.marginTop = "-8px";

                const customLbl = document.createElement("div");
                customLbl.className = "prop-label";
                customLbl.textContent = "Custom Google Font";

                const customInput = document.createElement("input");
                customInput.className = "prop-input";
                customInput.type = "text";
                customInput.placeholder = "e.g., Pacifico, Dancing Script";
                customInput.value = (widget.props.font_family === "Custom..." ? "" : (isCustom ? currentFont : (widget.props.custom_font_family || "")));

                customInput.addEventListener("input", () => {
                    const val = customInput.value.trim();
                    widget.props.font_family = val || "Roboto";
                    widget.props.custom_font_family = val;
                    renderCanvas();
                    scheduleSnippetUpdate();
                });

                customWrap.appendChild(customLbl);
                customWrap.appendChild(customInput);
                panel.appendChild(customWrap);

                const customHint = document.createElement("div");
                customHint.style.fontSize = "9px";
                customHint.style.color = "#666";
                customHint.style.marginTop = "2px";
                customHint.style.marginBottom = "8px";
                customHint.innerHTML = 'Browse <a href="https://fonts.google.com" target="_blank" style="color: #52c7ea">fonts.google.com</a>';
                panel.appendChild(customHint);
            }
        }

        addSelect("Text color", widget.props.color || "black", ["black", "white", "gray"], (val) => {
            widget.props.color = val;
            renderCanvas();
            scheduleSnippetUpdate();
        });

    }

    if (type === "puppet") {
        addLabeledInput("File path / URL", "text", widget.props.image_url || "", (v) => {
            widget.props.image_url = v;
            renderCanvas();
            scheduleSnippetUpdate();
        });

        const mdiHint = document.createElement("div");
        mdiHint.style.fontSize = "9px";
        mdiHint.style.color = "#666";
        mdiHint.style.marginTop = "-8px";
        mdiHint.style.marginBottom = "8px";
        mdiHint.innerHTML = 'Tip: Use mdi:icon-name for Material Design Icons. <br><b>Important:</b> Ensure `materialdesignicons-webfont.ttf` is in your ESPHome `fonts/` folder. <a href="https://pictogrammers.com/library/mdi/" target="_blank" style="color: #52c7ea">MDI Library</a>';
        panel.appendChild(mdiHint);

        addSelect(
            "Image type",
            widget.props.image_type || "RGB565",
            ["RGB565", "RGB", "GRAYSCALE", "BINARY"],
            (val) => {
                widget.props.image_type = val;
                scheduleSnippetUpdate();
            }
        );

        const typeHint = document.createElement("div");
        typeHint.style.fontSize = "9px";
        typeHint.style.color = "#666";
        typeHint.style.marginTop = "-8px";
        typeHint.style.marginBottom = "8px";
        typeHint.textContent = "RGB565=2B/px, RGB=3B/px, GRAYSCALE=1B/px, BINARY=1bit/px";
        panel.appendChild(typeHint);

        addSelect(
            "Transparency",
            widget.props.transparency || "opaque",
            ["opaque", "chroma_key", "alpha_channel"],
            (val) => {
                widget.props.transparency = val;
                scheduleSnippetUpdate();
            }
        );

        const transHint = document.createElement("div");
        transHint.style.fontSize = "9px";
        transHint.style.color = "#666";
        transHint.style.marginTop = "-8px";
        transHint.style.marginBottom = "8px";
        transHint.textContent = "opaque=no transparency, chroma_key=color key, alpha_channel=smooth blend";
        panel.appendChild(transHint);
    }

    if (type === "shape_rect" || type === "shape_circle") {
        const fillWrap = document.createElement("div");
        fillWrap.className = "field";
        const fillLbl = document.createElement("div");
        fillLbl.className = "prop-label";
        fillLbl.textContent = "Fill shape";
        const fillCb = document.createElement("input");
        fillCb.type = "checkbox";
        fillCb.checked = !!widget.props.fill;
        fillCb.addEventListener("change", () => {
            widget.props.fill = fillCb.checked;
            renderCanvas();
            scheduleSnippetUpdate();
        });
        fillWrap.appendChild(fillLbl);
        fillWrap.appendChild(fillCb);
        panel.appendChild(fillWrap);

        addLabeledInput(
            "Border width (px)",
            "number",
            widget.props.border_width != null ? widget.props.border_width : 1,
            (v) => {
                let n = parseInt(v || "1", 10);
                if (Number.isNaN(n) || n < 0) n = 0;
                widget.props.border_width = n;
                renderCanvas();
            }
        );

        addSelect(
            "Shape color",
            widget.props.color || "black",
            ["black", "white", "gray"],
            (val) => {
                widget.props.color = val;
                renderCanvas();
            }
        );

        addLabeledInput(
            "Fill opacity (0-100)",
            "number",
            widget.props.opacity != null ? widget.props.opacity : 100,
            (v) => {
                let n = parseInt(v || "100", 10);
                if (Number.isNaN(n)) n = 100;
                widget.props.opacity = Math.max(0, Math.min(100, n));
                renderCanvas();
            }
        );
    }

    if (type === "line") {
        addLabeledInput(
            "Stroke width (px)",
            "number",
            widget.props.stroke_width != null ? widget.props.stroke_width : 1,
            (v) => {
                let n = parseInt(v || "1", 10);
                if (Number.isNaN(n) || n < 1) n = 1;
                widget.props.stroke_width = n;
                renderCanvas();
            }
        );
        addSelect(
            "Line color",
            widget.props.color || "black",
            ["black", "white", "gray"],
            (val) => {
                widget.props.color = val;
                renderCanvas();
            }
        );
    }

    const condSectionHeader = document.createElement("h3");
    condSectionHeader.textContent = "Conditional Visibility";
    condSectionHeader.style.marginTop = "12px";
    condSectionHeader.style.borderTop = "1px solid var(--border-subtle)";
    condSectionHeader.style.paddingTop = "8px";
    panel.appendChild(condSectionHeader);

    const condHelpWrap = document.createElement("div");
    condHelpWrap.className = "field";
    condHelpWrap.style.fontSize = "9px";
    condHelpWrap.style.color = "var(--muted)";
    condHelpWrap.style.marginBottom = "6px";
    condHelpWrap.innerHTML = "Show/hide this widget based on an entity's state.";
    panel.appendChild(condHelpWrap);

    const condEntityWrap = document.createElement("div");
    condEntityWrap.className = "field";
    const condEntityLbl = document.createElement("div");
    condEntityLbl.className = "prop-label";
    condEntityLbl.textContent = "Condition Entity (optional)";

    const condEntityRow = document.createElement("div");
    condEntityRow.style.display = "flex";
    condEntityRow.style.gap = "4px";

    const condEntityInput = document.createElement("input");
    condEntityInput.className = "prop-input";
    condEntityInput.type = "text";
    condEntityInput.value = widget.condition_entity || "";
    condEntityInput.style.flex = "1";
    condEntityInput.placeholder = "e.g., binary_sensor.printer_printing";
    condEntityInput.addEventListener("input", () => {
        widget.condition_entity = condEntityInput.value || null;
        scheduleSnippetUpdate();
    });

    const condPickerBtn = document.createElement("button");
    condPickerBtn.className = "btn btn-secondary";
    condPickerBtn.textContent = "⋮⋮⋮";
    condPickerBtn.style.padding = "5px 8px";
    condPickerBtn.style.fontSize = "10px";
    condPickerBtn.type = "button";
    condPickerBtn.title = "Pick from Home Assistant entities";
    condPickerBtn.addEventListener("click", () => {
        openEntityPickerForWidget({
            entity_id: widget.condition_entity || "",
            title: ""
        }, condEntityInput, (selectedEntity) => {
            widget.condition_entity = selectedEntity;
            condEntityInput.value = selectedEntity;
            scheduleSnippetUpdate();
        });
    });

    condEntityRow.appendChild(condEntityInput);
    condEntityRow.appendChild(condPickerBtn);
    condEntityWrap.appendChild(condEntityLbl);
    condEntityWrap.appendChild(condEntityRow);
    panel.appendChild(condEntityWrap);

    addSelect(
        "Operator",
        widget.condition_operator || "==",
        ["==", "!=", ">", "<", ">=", "<="],
        (val) => {
            widget.condition_operator = val;
            scheduleSnippetUpdate();
        }
    );

    addLabeledInput("Expected value", "text", widget.condition_state || "", (v) => {
        widget.condition_state = v || null;
        scheduleSnippetUpdate();
    });

    const clearCondWrap = document.createElement("div");
    clearCondWrap.className = "field";
    clearCondWrap.style.marginTop = "4px";
    const clearCondBtn = document.createElement("button");
    clearCondBtn.className = "btn btn-secondary btn-full";
    clearCondBtn.textContent = "Clear Condition";
    clearCondBtn.type = "button";
    clearCondBtn.addEventListener("click", () => {
        widget.condition_entity = null;
        widget.condition_state = null;
        widget.condition_operator = null;
        renderPropertiesPanel();
        scheduleSnippetUpdate();
    });
    clearCondWrap.appendChild(clearCondBtn);
    panel.appendChild(clearCondWrap);
}

function screenToCanvasPosition(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    let x = clientX - rect.left;
    let y = clientY - rect.top;
    x = Math.max(0, Math.min(CANVAS_WIDTH - 10, x));
    y = Math.max(0, Math.min(CANVAS_HEIGHT - 10, y));
    return { x, y };
}

let dragState = null;

function onWidgetMouseDown(ev, widgetId) {
    const widget = widgetsById.get(widgetId);
    if (!widget) return;
    selectedWidgetId = widgetId;
    renderCanvas();
    renderPropertiesPanel();

    const target = ev.target;
    const rect = canvas.getBoundingClientRect();

    if (target.classList.contains("widget-resize-handle")) {
        dragState = {
            mode: "resize",
            id: widgetId,
            startX: ev.clientX,
            startY: ev.clientY,
            startW: widget.width,
            startH: widget.height
        };
    } else {
        dragState = {
            mode: "move",
            id: widgetId,
            offsetX: ev.clientX - (rect.left + widget.x),
            offsetY: ev.clientY - (rect.top + widget.y)
        };
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    ev.preventDefault();
}

function deleteWidget(widgetId) {
    const page = getCurrentPage();
    if (!page) return;
    const idx = page.widgets.findIndex((w) => w.id === widgetId);
    if (idx === -1) return;
    page.widgets.splice(idx, 1);
    widgetsById.delete(widgetId);
    selectedWidgetId = null;
    renderCanvas();
    renderPropertiesPanel();
    scheduleSnippetUpdate();
    recordHistory();
}

function deletePage(pageIndex) {
    if (pages.length <= 1) {
        alert("Cannot delete the last page. At least one page is required.");
        return;
    }

    pages.splice(pageIndex, 1);

    if (currentPageIndex >= pages.length) {
        currentPageIndex = pages.length - 1;
    } else if (currentPageIndex > pageIndex) {
        currentPageIndex--;
    }

    selectedWidgetId = null;
    rebuildWidgetsIndex();
    renderPagesSidebar();
    renderCanvas();
    renderPropertiesPanel();
    scheduleSnippetUpdate();
    recordHistory();
}

window.addEventListener("keydown", (ev) => {
    if ((ev.key === "Delete" || ev.key === "Backspace") && selectedWidgetId) {
        if (ev.target.tagName === "INPUT" || ev.target.tagName === "TEXTAREA") {
            return;
        }
        ev.preventDefault();
        deleteWidget(selectedWidgetId);
        return;
    }

    // Copy: Ctrl+C
    if ((ev.ctrlKey || ev.metaKey) && ev.key === "c") {
        if (ev.target.tagName === "INPUT" || ev.target.tagName === "TEXTAREA") return;
        ev.preventDefault();
        copyWidget();
    }

    // Paste: Ctrl+V
    if ((ev.ctrlKey || ev.metaKey) && ev.key === "v") {
        if (ev.target.tagName === "INPUT" || ev.target.tagName === "TEXTAREA") return;
        ev.preventDefault();
        pasteWidget();
    }

    // Undo: Ctrl+Z
    if ((ev.ctrlKey || ev.metaKey) && ev.key === "z" && !ev.shiftKey) {
        ev.preventDefault();
        undo();
    }

    // Redo: Ctrl+Y or Ctrl+Shift+Z
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === "y" || (ev.key === "z" && ev.shiftKey))) {
        ev.preventDefault();
        redo();
    }
});

function onMouseMove(ev) {
    if (!dragState) return;
    const widget = widgetsById.get(dragState.id);
    if (!widget) return;

    if (!canvas.querySelector(".canvas-grid")) {
        const grid = document.createElement("div");
        grid.className = "canvas-grid";
        canvas.insertBefore(grid, canvas.firstChild || null);
    }

    if (dragState.mode === "move") {
        const rect = canvas.getBoundingClientRect();
        let x = ev.clientX - rect.left - dragState.offsetX;
        let y = ev.clientY - rect.top - dragState.offsetY;
        x = Math.max(0, Math.min(CANVAS_WIDTH - widget.width, x));
        y = Math.max(0, Math.min(CANVAS_HEIGHT - widget.height, y));

        const snapped = applySnapToPosition(widget, x, y, ev);
        widget.x = snapped.x;
        widget.y = snapped.y;
    } else if (dragState.mode === "resize") {
        let w = dragState.startW + (ev.clientX - dragState.startX);
        let h = dragState.startH + (ev.clientY - dragState.startY);
        w = Math.max(10, Math.min(CANVAS_WIDTH - widget.x, w));
        h = Math.max(10, Math.min(CANVAS_HEIGHT - widget.y, h));
        widget.width = Math.round(w);
        widget.height = Math.round(h);

        const wtype = (widget.type || "").toLowerCase();
        if (wtype === "icon") {
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
            // Enforce 1:1 aspect ratio
            const size = Math.max(widget.width, widget.height);
            widget.width = size;
            widget.height = size;
        }
    }

    renderCanvas();
}

function onMouseUp() {
    const wasDragging = !!dragState;
    dragState = null;
    clearSnapGuides();
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    renderCanvas();
    renderPropertiesPanel();
    scheduleSnippetUpdate();
    if (wasDragging) recordHistory();
}

function getPagesPayload() {
    return {
        device_id: "reterminal_e1001",
        name: deviceName,
        current_page: currentPageIndex,
        orientation: settings.orientation,
        dark_mode: settings.dark_mode,
        sleep_enabled: settings.sleep_enabled,
        sleep_start_hour: settings.sleep_start_hour,
        sleep_end_hour: settings.sleep_end_hour,
        manual_refresh_only: settings.manual_refresh_only,
        no_refresh_start_hour: settings.no_refresh_start_hour,
        no_refresh_end_hour: settings.no_refresh_end_hour,
        pages
    };
}

function generateSnippetLocally() {
    const payload = getPagesPayload();
    // Ensure we are using the latest pages from the payload, which reflects the current state
    const pagesLocal = payload.pages || [];
    const lines = [];

    const iconCodes = new Set();
    for (const page of pagesLocal) {
        if (!page || !Array.isArray(page.widgets)) continue;
        for (const w of page.widgets) {
            const t = (w.type || "").toLowerCase();
            const p = w.props || {};
            if (t === "icon") {
                const raw = (p.code || "").trim().toUpperCase().replace(/^0X/, "");
                if (/^F[0-9A-F]{4}$/i.test(raw)) {
                    iconCodes.add(raw);
                }
            }
        }
    }

    lines.push("# Local preview snippet (fallback)");
    lines.push("# Paste below your base ESPHome config.");
    lines.push("# IMPORTANT: Ensure 'materialdesignicons-webfont.ttf' is placed in your ESPHome config:");
    lines.push("#   /config/esphome/fonts/materialdesignicons-webfont.ttf");
    lines.push("# Then keep the 'file: fonts/materialdesignicons-webfont.ttf' path below.");
    lines.push("");

    if (iconCodes.size > 0) {
        lines.push("font:");
        lines.push("  # Icon fonts used by MDI icon widgets generated from the reTerminal editor.");
        lines.push("  - file: 'fonts/materialdesignicons-webfont.ttf'");
        lines.push("    id: font_mdi_large");
        lines.push("    size: 200");
        lines.push("    glyphs: &mdi_glyphs");
        iconCodes.forEach((code) => {
            const hex = code.toUpperCase();
            lines.push(`      - "\\\\U000${hex}"`);
        });
        lines.push("  - file: 'fonts/materialdesignicons-webfont.ttf'");
        lines.push("    id: font_mdi_medium");
        lines.push("    size: 40");
        lines.push("    glyphs: *mdi_glyphs");
        lines.push("");
    }

    // Collect all graph widgets to generate graph: declarations
    const graphWidgets = [];
    for (const page of pagesLocal) {
        if (!page || !Array.isArray(page.widgets)) continue;
        for (const w of page.widgets) {
            const t = (w.type || "").toLowerCase();
            if (t === "graph") {
                graphWidgets.push(w);
            }
        }
    }

    // Generate graph: component declarations
    if (graphWidgets.length > 0) {
        lines.push("graph:");
        graphWidgets.forEach(w => {
            const entityId = (w.entity_id || "").trim();
            const p = w.props || {};
            const duration = p.duration || "1h";
            const border = p.border !== false;
            const graphId = `graph_${w.id}`.replace(/-/g, "_");

            lines.push(`  - id: ${graphId}`);
            lines.push(`    duration: ${duration}`);
            lines.push(`    width: ${w.width || 200}`);
            lines.push(`    height: ${w.height || 100}`);
            lines.push(`    border: ${border}`);

            // Optional grid settings
            if (p.x_grid && p.x_grid.trim()) {
                lines.push(`    x_grid: ${p.x_grid.trim()}`);
            }
            if (p.y_grid && p.y_grid.trim()) {
                lines.push(`    y_grid: ${p.y_grid.trim()}`);
            }

            // Title / Label
            if (w.title && w.title.trim()) {
                lines.push(`    # title: "${w.title.trim()}"`);
            }

            // Traces (currently only one supported by editor UI)
            lines.push(`    traces:`);
            if (entityId) {
                const sensorId = entityId.replace(/\./g, "_").replace(/-/g, "_");
                lines.push(`      - sensor: ${sensorId}`);
            } else {
                lines.push(`      - sensor: sensor_undefined`);
            }

            // Trace styling
            if (p.line_thickness && p.line_thickness !== 3) {
                lines.push(`        line_thickness: ${p.line_thickness}`);
            }
            if (p.line_type && p.line_type !== "SOLID") {
                lines.push(`        line_type: ${p.line_type}`);
            }
            if (p.continuous) {
                lines.push(`        continuous: true`);
            }

            // Y-axis range settings
            if (p.min_value && p.min_value.trim()) {
                lines.push(`    min_value: ${p.min_value.trim()}`);
            }
            if (p.max_value && p.max_value.trim()) {
                lines.push(`    max_value: ${p.max_value.trim()}`);
            }
            if (p.min_range && p.min_range.trim()) {
                lines.push(`    min_range: ${p.min_range.trim()}`);
            }
            if (p.max_range && p.max_range.trim()) {
                lines.push(`    max_range: ${p.max_range.trim()}`);
            }

            // Local sensor marker
            if (p.is_local_sensor) {
                lines.push(`    # // local: true`);
            }
        });
        lines.push("");
    }

    // Collect all puppet widgets
    const puppetWidgets = [];
    for (const page of pagesLocal) {
        if (!page || !Array.isArray(page.widgets)) continue;
        for (const w of page.widgets) {
            const t = (w.type || "").toLowerCase();
            if (t === "puppet") {
                puppetWidgets.push(w);
            }
        }
    }

    // Generate online_image: component declarations for Puppet
    if (puppetWidgets.length > 0) {
        lines.push("# Required for Puppet widgets (uncomment if not already present)");
        lines.push("# http_request:");
        lines.push("#   verify_ssl: false");
        lines.push("#   timeout: 20s");
        lines.push("");

        lines.push("online_image:");
        puppetWidgets.forEach(w => {
            const p = w.props || {};
            const url = p.image_url || "";
            const puppetId = `puppet_${w.id}`.replace(/-/g, "_");

            lines.push(`    on_download_finished:`);
            lines.push(`      - component.update: epaper_display`);
        });
        lines.push("");
    }

    // Collect all entities used in widgets
    const usedEntities = new Map(); // id -> { domain, entity_id }

    for (const page of pagesLocal) {
        if (!page || !Array.isArray(page.widgets)) continue;
        for (const w of page.widgets) {
            const p = w.props || {};
            // Check main entity
            if (w.entity_id) {
                const parts = w.entity_id.split('.');
                if (parts.length === 2) {
                    let domain = parts[0];
                    // Force 'text_sensor' domain if widget is explicitly marked as text sensor
                    if (p.is_text_sensor) {
                        domain = 'text_sensor';
                    }
                    usedEntities.set(w.entity_id, { domain: domain, entity_id: w.entity_id });
                }
            }
            // Check condition entity
            if (w.condition_entity) {
                const parts = w.condition_entity.split('.');
                if (parts.length === 2) {
                    // Condition entities are usually binary_sensor or sensor, keep original domain
                    usedEntities.set(w.condition_entity, { domain: parts[0], entity_id: w.condition_entity });
                }
            }
        }
    }

    lines.push("# ============================================================================");
    lines.push("# ▼▼▼ ATTENTION: REQUIRED SENSORS ▼▼▼");
    lines.push("# The widgets below use these Home Assistant entities.");
    lines.push("# You must ensure they are defined in your main ESPHome configuration.");
    lines.push("# If they are missing from your config, UNCOMMENT them here and COPY them");
    lines.push("# to your main 'sensor:' / 'binary_sensor:' sections.");
    lines.push("# They are commented out by default to prevent 'Duplicate ID' errors.");
    lines.push("# ============================================================================");
    lines.push("");

    const domains = ['sensor', 'binary_sensor', 'text_sensor', 'weather', 'switch', 'number', 'select', 'button'];
    for (const domain of domains) {
        const domainEntities = Array.from(usedEntities.values()).filter(e => e.domain === domain);
        if (domainEntities.length > 0) {
            lines.push(`# ${domain}:`);
            for (const e of domainEntities) {
                const safeId = e.entity_id.replace(/\./g, "_").replace(/-/g, "_");
                lines.push(`#   - platform: homeassistant`);
                lines.push(`#     id: ${safeId}`);
                lines.push(`#     entity_id: ${e.entity_id}`);
                lines.push(`#     internal: true`);
            }
            lines.push("");
        }
    }

    lines.push("globals:");
    lines.push("  - id: display_page");
    lines.push("    type: int");
    lines.push("    restore_value: true");
    lines.push("    initial_value: '0'");
    lines.push("");
    lines.push("display:");
    lines.push("  - platform: waveshare_epaper");
    lines.push("    id: epaper_display");
    lines.push("    model: 7.50inv2");
    lines.push("    cs_pin: GPIO10");
    lines.push("    dc_pin: GPIO11");
    lines.push("    reset_pin:");
    lines.push("      number: GPIO12");
    lines.push("      inverted: false");
    lines.push("    busy_pin:");
    lines.push("      number: GPIO13");
    lines.push("      inverted: true");
    lines.push("    update_interval: 0s");
    lines.push("    lambda: |-");
    lines.push("      int page = id(display_page);");

    pages.forEach((page, pageIndex) => {
        lines.push(`      if (page == ${pageIndex}) {`);
        if (!page.widgets || !page.widgets.length) {
            lines.push("        // No widgets on this page.");
        } else {
            for (const w of page.widgets) {
                const t = (w.type || "").toLowerCase();
                const p = w.props || {};

                // Add local sensor marker comment for relevant widgets
                let localMarker = "";
                if (p.is_local_sensor) {
                    localMarker = " // local: true";
                }

                if (t === "text" || t === "label") {
                    const txt = (p.text || w.title || "Text").replace(/"/g, '\\"');
                    if (!txt) continue;
                    const fontSize = parseInt(p.font_size || 12, 10) || 12;
                    const colorProp = p.color || "black";
                    const color = colorProp === "white" ? "COLOR_OFF" : "COLOR_ON";
                    const textAlign = p.text_align || "TOP_LEFT";
                    const fontWeight = p.font_weight || 400;
                    const fontFamily = p.font_family || "Roboto";
                    const italic = p.italic ? "true" : "false";
                    const bpp = p.bpp || 1;

                    lines.push(`        // widget:text id:${w.id} type:text x:${w.x} y:${w.y} w:${w.width} h:${w.height} text:"${txt}" font:"${fontFamily}" size:${fontSize} weight:${fontWeight} italic:${italic} bpp:${bpp} color:${colorProp} align:${textAlign}`);
                    lines.push(`        // Note: Configure font with weight in font: section. Example:`);
                    lines.push(`        // font:`);
                    lines.push(`        //   - file:`);
                    lines.push(`        //       type: gfonts`);
                    lines.push(`        //       family: ${fontFamily}`);
                    lines.push(`        //       weight: ${fontWeight}`);
                    if (p.italic) {
                        lines.push(`        //       italic: true`);
                    }
                    lines.push(`        //     id: font_${fontFamily.toLowerCase().replace(/\s+/g, '_')}_${fontWeight}`);
                    lines.push(`        //     size: ${fontSize}`);
                    lines.push(`        //     bpp: ${bpp}  # 1=no AA, 2=4 levels, 4=16 levels, 8=256 levels`);
                    lines.push(`        it.printf(${w.x}, ${w.y}, id(font_normal), ${color}, TextAlign::${textAlign}, "${txt}");`);
                } else if (t === "sensor_text") {
                    const entityId = (w.entity_id || "").trim();
                    const label = (w.title || "").replace(/"/g, '\\"');
                    const valueFormat = p.value_format || "label_value";
                    const labelFontSize = parseInt(p.label_font_size || 14, 10) || 14;
                    const valueFontSize = parseInt(p.value_font_size || 20, 10) || 20;
                    const colorProp = p.color || "black";
                    const color = colorProp === "white" ? "COLOR_OFF" : "COLOR_ON";
                    const textAlign = p.text_align || "TOP_LEFT";
                    const precision = parseInt(p.precision !== undefined ? p.precision : -1, 10);
                    const unit = p.unit || "";

                    lines.push(`        // widget:sensor_text id:${w.id} type:sensor_text x:${w.x} y:${w.y} w:${w.width} h:${w.height} ent:${entityId} title:"${label}" format:${valueFormat} label_font:${labelFontSize} value_font:${valueFontSize} color:${colorProp} align:${textAlign} precision:${precision} unit:"${unit}" local:${!!p.is_local_sensor}`);

                    if (entityId) {
                        const safeId = entityId.replace(/\./g, "_").replace(/-/g, "_");
                        // Determine if it's a numeric sensor or text sensor
                        // Default to numeric for 'sensor.' unless is_text_sensor is explicitly true
                        const isNumeric = entityId.startsWith("sensor.") && !p.is_text_sensor;

                        let valueExpr = `id(${safeId}).state`;
                        let fmtSpec = "%.1f";
                        if (precision >= 0) fmtSpec = `%${precision}.${precision}f`;

                        if (!isNumeric) {
                            // For text sensors, .state is a std::string, so we need .c_str() for printf
                            valueExpr = `id(${safeId}).state.c_str()`;
                            fmtSpec = "%s";
                        }

                        if (valueFormat === "label_value") {
                            lines.push(`        it.printf(${w.x}, ${w.y}, id(font_small), ${color}, TextAlign::TOP_LEFT, "${label}");`);
                            lines.push(`        it.printf(${w.x}, ${w.y} + ${labelFontSize} + 2, id(font_large), ${color}, TextAlign::TOP_LEFT, "${fmtSpec}%s", ${valueExpr}, "${unit}");`);
                        } else if (valueFormat === "value_only") {
                            lines.push(`        it.printf(${w.x}, ${w.y}, id(font_large), ${color}, TextAlign::${textAlign}, "${fmtSpec}%s", ${valueExpr}, "${unit}");`);
                        } else {
                            // label_only
                            lines.push(`        it.printf(${w.x}, ${w.y}, id(font_medium), ${color}, TextAlign::${textAlign}, "${label}");`);
                        }
                    } else {
                        lines.push(`        it.printf(${w.x}, ${w.y}, id(font_medium), ${color}, TextAlign::${textAlign}, "${label}: (No Entity)");`);
                    }

                } else if (t === "graph") {
                    const entityId = (w.entity_id || "").trim();
                    const title = (w.title || "").replace(/"/g, '\\"');
                    const duration = p.duration || "1h";
                    const borderEnabled = p.border !== false;
                    const colorProp = p.color || "black";
                    const color = colorProp === "white" ? "COLOR_OFF" : "COLOR_ON";
                    const xGrid = p.x_grid || "";
                    const yGrid = p.y_grid || "";
                    const lineType = p.line_type || "SOLID";
                    const lineThickness = parseInt(p.line_thickness || 3, 10);
                    const continuous = !!p.continuous;
                    const minValue = p.min_value || "";
                    const maxValue = p.max_value || "";
                    const minRange = p.min_range || "";
                    const maxRange = p.max_range || "";

                    const safeId = `graph_${w.id}`.replace(/-/g, "_");

                    lines.push(`        // widget:graph id:${w.id} type:graph x:${w.x} y:${w.y} w:${w.width} h:${w.height} title:"${title}" entity:${entityId} local:${!!p.is_local_sensor} duration:${duration} border:${borderEnabled} color:${colorProp} x_grid:${xGrid} y_grid:${yGrid} line_type:${lineType} line_thickness:${lineThickness} continuous:${continuous} min_value:${minValue} max_value:${maxValue} min_range:${minRange} max_range:${maxRange}`);

                    if (entityId) {
                        // Add to graph: section (handled by backend usually, but we add comments for local)
                        lines.push(`        // graph:`);
                        lines.push(`        //   - id: ${safeId}`);
                        lines.push(`        //     entity: ${entityId}`);
                        lines.push(`        //     duration: ${duration}`);
                        lines.push(`        //     width: ${w.width}`);
                        lines.push(`        //     height: ${w.height}`);

                        lines.push(`        it.graph(${w.x}, ${w.y}, id(${safeId}));`);
                        if (title) {
                            lines.push(`        it.printf(${w.x}+4, ${w.y}+2, id(font_small), ${color}, TextAlign::TOP_LEFT, "${title}");`);
                        }
                    } else {
                        lines.push(`        it.rectangle(${w.x}, ${w.y}, ${w.width}, ${w.height}, ${color});`);
                        lines.push(`        it.printf(${w.x}+5, ${w.y}+5, id(font_small), ${color}, TextAlign::TOP_LEFT, "Graph (no entity)");`);
                    }
                } else if (t === "progress_bar") {
                    const entityId = (w.entity_id || "").trim();
                    const title = (w.title || "").replace(/"/g, '\\"');
                    const showLabel = p.show_label !== false;
                    const showPercentage = p.show_percentage !== false;
                    const barHeight = parseInt(p.bar_height || 15, 10);
                    const borderWidth = parseInt(p.border_width || 1, 10);
                    const colorProp = p.color || "black";
                    const color = colorProp === "white" ? "COLOR_OFF" : "COLOR_ON";

                    lines.push(`        // widget:progress_bar id:${w.id} type:progress_bar x:${w.x} y:${w.y} w:${w.width} h:${w.height} entity:${entityId} title:"${title}" show_label:${showLabel} show_pct:${showPercentage} bar_height:${barHeight} border:${borderWidth} color:${colorProp} local:${!!p.is_local_sensor}`);

                    if (entityId) {
                        const safeId = entityId.replace(/\./g, "_").replace(/-/g, "_");
                        lines.push(`        // Progress Bar for ${entityId}`);
                        lines.push(`        // Note: Requires a sensor with percentage value (0-100)`);
                        lines.push(`        float val_${w.id} = id(${safeId}).state;`);
                        lines.push(`        if (std::isnan(val_${w.id})) val_${w.id} = 0;`);
                        lines.push(`        int pct_${w.id} = (int)val_${w.id};`);
                        lines.push(`        if (pct_${w.id} < 0) pct_${w.id} = 0;`);
                        lines.push(`        if (pct_${w.id} > 100) pct_${w.id} = 100;`);

                        // Draw label
                        if (showLabel && title) {
                            lines.push(`        it.printf(${w.x}, ${w.y}, id(font_small), ${color}, TextAlign::TOP_LEFT, "${title}");`);
                        }

                        // Draw percentage
                        if (showPercentage) {
                            lines.push(`        it.printf(${w.x} + ${w.width}, ${w.y}, id(font_small), ${color}, TextAlign::TOP_RIGHT, "%d%%", pct_${w.id});`);
                        }

                        // Draw bar
                        const barY = w.y + (w.height - barHeight);
                        lines.push(`        it.rectangle(${w.x}, ${barY}, ${w.width}, ${barHeight}, ${color});`);
                        lines.push(`        if (pct_${w.id} > 0) {`);
                        lines.push(`          int bar_w = (${w.width} - 4) * pct_${w.id} / 100;`);
                        lines.push(`          it.filled_rectangle(${w.x} + 2, ${barY} + 2, bar_w, ${barHeight} - 4, ${color});`);
                        lines.push(`        }`);
                    } else {
                        lines.push(`        // Progress Bar (Preview)`);
                        lines.push(`        it.rectangle(${w.x}, ${w.y} + ${w.height} - ${barHeight}, ${w.width}, ${barHeight}, ${color});`);
                        lines.push(`        it.filled_rectangle(${w.x} + 2, ${w.y} + ${w.height} - ${barHeight} + 2, ${w.width} / 2, ${barHeight} - 4, ${color});`);
                        if (showLabel && title) {
                            lines.push(`        it.printf(${w.x}, ${w.y}, id(font_small), ${color}, TextAlign::TOP_LEFT, "${title}");`);
                        }
                    }

                } else if (t === "icon") {
                    const code = (p.code || "F0595").replace(/^0x/i, "");
                    const size = parseInt(p.size || 40, 10);
                    const colorProp = p.color || "black";
                    const color = colorProp === "white" ? "COLOR_OFF" : "COLOR_ON";
                    const fontRef = (size >= 100) ? "font_mdi_large" : "font_mdi_medium";

                    lines.push(`        // widget:icon id:${w.id} type:icon x:${w.x} y:${w.y} w:${w.width} h:${w.height} code:${code} size:${size} color:${colorProp}`);
                    lines.push(`        it.print(${w.x}, ${w.y}, id(${fontRef}), ${color}, "\\U000${code}");`);

                } else if (t === "battery_icon") {
                    const entityId = (w.entity_id || "").trim();
                    const size = parseInt(p.size || 24, 10);
                    const colorProp = p.color || "black";
                    const color = colorProp === "white" ? "COLOR_OFF" : "COLOR_ON";

                    lines.push(`        // widget:battery_icon id:${w.id} type:battery_icon x:${w.x} y:${w.y} w:${w.width} h:${w.height} entity:${entityId} size:${size} color:${colorProp} local:${!!p.is_local_sensor}`);

                    if (entityId) {
                        const safeId = entityId.replace(/\./g, "_").replace(/-/g, "_");
                        lines.push(`        // Battery Icon for ${entityId}`);
                        lines.push(`        float bat_${w.id} = id(${safeId}).state;`);
                        lines.push(`        if (std::isnan(bat_${w.id})) bat_${w.id} = 0;`);
                        lines.push(`        // Simple battery drawing logic (placeholder)`);
                        lines.push(`        it.rectangle(${w.x}, ${w.y}, ${w.width}, ${w.height}, ${color});`);
                        lines.push(`        it.printf(${w.x}+2, ${w.y}+2, id(font_small), ${color}, "%.0f%%", bat_${w.id});`);
                    } else {
                        lines.push(`        it.rectangle(${w.x}, ${w.y}, ${w.width}, ${w.height}, ${color});`);
                        lines.push(`        it.printf(${w.x}+2, ${w.y}+2, id(font_small), ${color}, "100%");`);
                    }

                } else if (t === "weather_icon") {
                    const entityId = (w.entity_id || "").trim();
                    const size = parseInt(p.size || 48, 10);
                    const colorProp = p.color || "black";
                    const color = colorProp === "white" ? "COLOR_OFF" : "COLOR_ON";

                    lines.push(`        // widget:weather_icon id:${w.id} type:weather_icon x:${w.x} y:${w.y} w:${w.width} h:${w.height} entity:${entityId} size:${size} color:${colorProp}`);

                    if (entityId) {
                        const safeId = entityId.replace(/\./g, "_").replace(/-/g, "_");
                        lines.push(`        // Weather Icon for ${entityId}`);
                        lines.push(`        // Note: You need a mapping function or switch case to select icon based on state`);
                        lines.push(`        it.printf(${w.x}, ${w.y}, id(font_mdi_medium), ${color}, "\\U000F0595"); // Default to sunny`);
                    } else {
                        lines.push(`        it.printf(${w.x}, ${w.y}, id(font_mdi_medium), ${color}, "\\U000F0595");`);
                    }

                } else if (t === "shape_rect") {
                    const fill = !!p.fill;
                    const borderWidth = parseInt(p.border_width || 1, 10);
                    const colorProp = p.color || "black";
                    const color = colorProp === "white" ? "COLOR_OFF" : "COLOR_ON";
                    const opacity = parseInt(p.opacity || 100, 10);

                    lines.push(`        // widget:shape_rect id:${w.id} type:shape_rect x:${w.x} y:${w.y} w:${w.width} h:${w.height} fill:${fill} border:${borderWidth} opacity:${opacity} color:${colorProp}`);

                    if (fill) {
                        lines.push(`        it.filled_rectangle(${w.x}, ${w.y}, ${w.width}, ${w.height}, ${color});`);
                    } else {
                        if (borderWidth <= 1) {
                            lines.push(`        it.rectangle(${w.x}, ${w.y}, ${w.width}, ${w.height}, ${color});`);
                        } else {
                            lines.push(`        for (int i=0; i<${borderWidth}; i++) {`);
                            lines.push(`          it.rectangle(${w.x}+i, ${w.y}+i, ${w.width}-2*i, ${w.height}-2*i, ${color});`);
                            lines.push(`        }`);
                        }
                    }

                } else if (t === "shape_circle") {
                    const r = Math.min(w.width, w.height) / 2;
                    const cx = w.x + w.width / 2;
                    const cy = w.y + w.height / 2;
                    const fill = !!p.fill;
                    const borderWidth = parseInt(p.border_width || 1, 10);
                    const colorProp = p.color || "black";
                    const color = colorProp === "white" ? "COLOR_OFF" : "COLOR_ON";
                    const opacity = parseInt(p.opacity || 100, 10);

                    lines.push(`        // widget:shape_circle id:${w.id} type:shape_circle x:${w.x} y:${w.y} w:${w.width} h:${w.height} fill:${fill} border:${borderWidth} opacity:${opacity} color:${colorProp}`);

                    if (fill) {
                        lines.push(`        it.filled_circle(${cx}, ${cy}, ${r}, ${color});`);
                    } else {
                        if (borderWidth <= 1) {
                            lines.push(`        it.circle(${cx}, ${cy}, ${r}, ${color});`);
                        } else {
                            lines.push(`        for (int i=0; i<${borderWidth}; i++) {`);
                            lines.push(`          it.circle(${cx}, ${cy}, ${r}-i, ${color});`);
                            lines.push(`        }`);
                        }
                    }

                } else if (t === "datetime") {
                    const format = p.format || "time_date";
                    const timeSize = parseInt(p.time_font_size || 28, 10);
                    const dateSize = parseInt(p.date_font_size || 16, 10);
                    const colorProp = p.color || "black";
                    const color = colorProp === "white" ? "COLOR_OFF" : "COLOR_ON";

                    lines.push(`        // widget:datetime id:${w.id} type:datetime x:${w.x} y:${w.y} w:${w.width} h:${w.height} format:${format} time_font:${timeSize} date_font:${dateSize} color:${colorProp}`);
                    lines.push(`        // Note: Requires 'time' component in ESPHome`);
                    lines.push(`        auto now = id(homeassistant_time).now();`);

                    if (format === "time_only") {
                        lines.push(`        it.strftime(${w.x}, ${w.y}, id(font_large), ${color}, TextAlign::TOP_LEFT, "%H:%M", now);`);
                    } else if (format === "date_only") {
                        lines.push(`        it.strftime(${w.x}, ${w.y}, id(font_medium), ${color}, TextAlign::TOP_LEFT, "%a, %b %d", now);`);
                    } else {
                        lines.push(`        it.strftime(${w.x}, ${w.y}, id(font_large), ${color}, TextAlign::TOP_LEFT, "%H:%M", now);`);
                        lines.push(`        it.strftime(${w.x}, ${w.y} + ${timeSize}, id(font_medium), ${color}, TextAlign::TOP_LEFT, "%a, %b %d", now);`);
                    }

                } else if (t === "image") {
                    const path = p.path || "";
                    const invert = !!p.invert;
                    lines.push(`        // widget:image id:${w.id} type:image x:${w.x} y:${w.y} w:${w.width} h:${w.height} path:"${path}" invert:${invert}`);
                    lines.push(`        // Note: Requires 'image' component with id matching filename`);
                    if (path) {
                        const filename = path.split("/").pop().replace(/\./g, "_");
                        lines.push(`        it.image(${w.x}, ${w.y}, id(img_${filename}));`);
                    }

                } else if (t === "online_image") {
                    const url = p.url || "";
                    lines.push(`        // widget:online_image id:${w.id} type:online_image x:${w.x} y:${w.y} w:${w.width} h:${w.height} url:"${url}"`);
                    lines.push(`        // Note: Requires 'online_image' component`);
                    lines.push(`        it.image(${w.x}, ${w.y}, id(online_image_${w.id}));`);

                } else if (t === "puppet") {
                    const url = p.image_url || "";
                    lines.push(`        // widget:puppet id:${w.id} type:puppet x:${w.x} y:${w.y} w:${w.width} h:${w.height} url:"${url}"`);
                    const puppetId = `puppet_${w.id}`.replace(/-/g, "_");
                    lines.push(`        it.image(${w.x}, ${w.y}, id(${puppetId}));`);

                } else if (t === "line") {
                    const colorProp = p.color || "black";
                    const color = colorProp === "white" ? "COLOR_ON" : "COLOR_OFF";
                    const dx = w.width || 0;
                    const dy = w.height || 0;
                    const x2 = w.x + dx;
                    const y2 = w.y + dy;
                    const strokeWidth = parseInt(p.stroke_width || 1, 10) || 1;
                    lines.push(`        // widget:line id:${w.id} type:line x:${w.x} y:${w.y} w:${w.width} h:${w.height} stroke:${strokeWidth} color:${colorProp}`);
                    if (strokeWidth <= 1) {
                        lines.push(`        it.line(${w.x}, ${w.y}, ${x2}, ${y2}, ${color});`);
                    } else {
                        lines.push(`        // line with stroke_width=${strokeWidth}`);
                        lines.push("        for (int i = 0; i < " + strokeWidth + "; i++) {");
                        lines.push(`          it.line(${w.x}, ${w.y}+i, ${x2}, ${y2}+i, ${color});`);
                        lines.push("        }");
                    }
                }
            }
        }
        lines.push("      }");
    });

    return lines.join("\n");
}

async function updateSnippet(preferBackend = true) {
    if (!snippetBox) return;

    const local = generateSnippetLocally();

    if (!preferBackend) {
        snippetBox.value = local + "\n# Local preview (no backend).";
        return;
    }

    try {
        // First, save the current layout to backend so it knows about the changes
        const body = getPagesPayload();
        const saveResp = await fetch("/api/reterminal_dashboard/layout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!saveResp.ok) {
            throw new Error("Failed to save layout to backend");
        }

        // Now fetch the generated snippet from backend
        const resp = await fetch("/api/reterminal_dashboard/snippet", { method: "GET" });
        if (!resp.ok) {
            throw new Error("HTTP " + resp.status);
        }
        const text = await resp.text();
        snippetBox.value = (text && text.trim()) ? text : "# Empty snippet";
    } catch (err) {
        console.warn("Backend error, using local generation:", err);
        snippetBox.value =
            local + "\n# Backend unreachable, showing local preview only.";
    }
}

let snippetDebounceTimer = null;
function scheduleSnippetUpdate() {
    if (!snippetBox) return;
    if (snippetDebounceTimer) clearTimeout(snippetDebounceTimer);
    snippetDebounceTimer = setTimeout(() => {
        updateSnippet(true);
    }, 300);
}

document.getElementById("widgetPalette").addEventListener("click", onWidgetPaletteClick);

const snapToggleEl = document.getElementById("snapToggle");
if (snapToggleEl) {
    snapToggleEl.checked = snapEnabled;
    snapToggleEl.addEventListener("change", () => {
        snapEnabled = !!snapToggleEl.checked;
        clearSnapGuides();
    });
}

let haEntitiesCache = null;
let haEntitiesLoaded = false;
let haEntitiesLoadError = false;

async function loadHaEntitiesIfNeeded() {
    if (!hasHaBackend || !hasHaBackend()) {
        haEntitiesLoadError = true;
        return [];
    }
    if (haEntitiesLoaded && haEntitiesCache) {
        return haEntitiesCache;
    }
    try {
        const resp = await fetch(`${HA_API_BASE}/entities?domains=sensor,binary_sensor,weather`);
        if (!resp.ok) {
            throw new Error("HTTP " + resp.status);
        }
        const data = await resp.json();
        if (!Array.isArray(data)) {
            throw new Error("Invalid response format");
        }
        haEntitiesCache = data;
        haEntitiesLoaded = true;
        return haEntitiesCache;
    } catch (err) {
        console.warn("Failed to load entities for picker; falling back to manual input.", err);
        haEntitiesLoadError = true;
        return [];
    }
}

function openEntityPickerForWidget(widget, inputEl, callback) {
    if (!hasHaBackend || !hasHaBackend() || haEntitiesLoadError) {
        return;
    }

    const container = propertiesPanel;
    const existing = container.querySelector(".entity-picker-overlay");
    if (existing) {
        existing.remove();
    }

    const overlay = document.createElement("div");
    overlay.className = "entity-picker-overlay";
    overlay.style.marginTop = "4px";
    overlay.style.padding = "4px";
    overlay.style.borderRadius = "6px";
    overlay.style.border = "1px solid var(--border-subtle)";
    overlay.style.background = "#05070b";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.gap = "4px";
    overlay.style.maxHeight = "160px";
    overlay.style.overflow = "hidden";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.gap = "4px";
    header.style.fontSize = "8px";
    header.style.color = "var(--muted)";
    header.textContent = "Pick Home Assistant entity";

    const closeBtn = document.createElement("button");
    closeBtn.className = "btn btn-secondary";
    closeBtn.textContent = "×";
    closeBtn.style.padding = "0 4px";
    closeBtn.style.fontSize = "9px";
    closeBtn.type = "button";
    closeBtn.addEventListener("click", () => {
        overlay.remove();
    });

    const headerRight = document.createElement("div");
    headerRight.style.display = "flex";
    headerRight.style.alignItems = "center";
    headerRight.style.gap = "4px";
    headerRight.appendChild(closeBtn);

    const headerWrap = document.createElement("div");
    headerWrap.style.display = "flex";
    headerWrap.style.justifyContent = "space-between";
    headerWrap.style.alignItems = "center";
    headerWrap.style.gap = "4px";
    headerWrap.appendChild(header);
    headerWrap.appendChild(headerRight);

    const searchRow = document.createElement("div");
    searchRow.style.display = "flex";
    searchRow.style.gap = "4px";
    searchRow.style.alignItems = "center";

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "prop-input";
    searchInput.placeholder = "Search name or entity_id";
    searchInput.style.flex = "1";

    const domainSelect = document.createElement("select");
    domainSelect.className = "prop-input";
    domainSelect.style.width = "80px";
    ["all", "sensor", "binary_sensor", "weather"].forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        domainSelect.appendChild(opt);
    });

    searchRow.appendChild(searchInput);
    searchRow.appendChild(domainSelect);

    const list = document.createElement("div");
    list.style.flex = "1";
    list.style.overflowY = "auto";
    list.style.borderRadius = "4px";
    list.style.border = "1px solid var(--border-subtle)";
    list.style.padding = "2px";
    list.style.fontSize = "8px";

    overlay.appendChild(headerWrap);
    overlay.appendChild(searchRow);
    overlay.appendChild(list);
    container.appendChild(overlay);

    function renderList(entities) {
        list.innerHTML = "";
        if (!entities || entities.length === 0) {
            const empty = document.createElement("div");
            empty.style.color = "var(--muted)";
            empty.textContent = "No entities match.";
            list.appendChild(empty);
            return;
        }
        entities.forEach((e) => {
            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.flexDirection = "column";
            row.style.padding = "2px 3px";
            row.style.borderRadius = "3px";
            row.style.cursor = "pointer";

            row.addEventListener("mouseenter", () => {
                row.style.background = "#0d1118";
            });
            row.addEventListener("mouseleave", () => {
                row.style.background = "transparent";
            });

            const name = document.createElement("div");
            name.style.fontSize = "8px";
            name.style.color = "var(--text)";
            name.textContent = e.name || e.entity_id;

            const meta = document.createElement("div");
            meta.style.fontSize = "7px";
            meta.style.color = "var(--muted)";
            meta.textContent = `${e.entity_id} · ${e.domain}`;

            row.appendChild(name);
            row.appendChild(meta);

            row.addEventListener("click", () => {
                if (callback) {
                    callback(e.entity_id);
                } else {
                    widget.entity_id = e.entity_id;
                    widget.title = e.name || e.entity_id || "";
                    inputEl.value = widget.entity_id;

                    // Automate Graph settings based on attributes
                    if (widget.type === "graph" && e.attributes) {
                        const attrs = e.attributes;
                        if (attrs.unit_of_measurement === "%") {
                            if (!widget.props.min_value) widget.props.min_value = "0";
                            if (!widget.props.max_value) widget.props.max_value = "100";
                        }
                        if (attrs.min !== undefined && !widget.props.min_value) widget.props.min_value = String(attrs.min);
                        if (attrs.max !== undefined && !widget.props.max_value) widget.props.max_value = String(attrs.max);
                    }
                    if (Object.keys(entityStatesCache).length === 0) {
                        fetchEntityStates();
                    }
                    renderCanvas();
                    renderPropertiesPanel();
                    scheduleSnippetUpdate();
                }
                overlay.remove();
            });

            list.appendChild(row);
        });
    }

    loadHaEntitiesIfNeeded().then((entities) => {
        if (!entities || entities.length === 0) {
            renderList([]);
            return;
        }

        function applyFilter() {
            const q = (searchInput.value || "").toLowerCase();
            const dom = domainSelect.value;
            const filtered = entities.filter((e) => {
                if (dom !== "all" && e.domain !== dom) {
                    return false;
                }
                if (!q) return true;
                const hay = `${e.entity_id} ${e.name || ""}`.toLowerCase();
                return hay.includes(q);
            });
            renderList(filtered);
        }

        searchInput.addEventListener("input", applyFilter);
        domainSelect.addEventListener("change", applyFilter);

        applyFilter();
    });
}

const orientationSelectEl = document.getElementById("orientationSelect");
if (orientationSelectEl) {
    orientationSelectEl.addEventListener("change", () => {
        applyOrientation(orientationSelectEl.value);
        scheduleSnippetUpdate();
    });
}

addPageBtn.onclick = () => {
    const id = "page_" + pages.length;
    pages.push({ id, name: "Page " + (pages.length + 1), widgets: [] });
    currentPageIndex = pages.length - 1;
    rebuildWidgetsIndex();
    renderPagesSidebar();
    renderCanvas();
    renderPropertiesPanel();
    scheduleSnippetUpdate();
};

const clearAllBtn = document.getElementById("clearAllBtn");
if (clearAllBtn) {
    clearAllBtn.onclick = () => {
        const page = getCurrentPage();
        if (!page) return;

        if (page.widgets.length === 0) {
            sidebarStatus.textContent = "Current page is already empty.";
            return;
        }

        if (confirm(`Remove all ${page.widgets.length} widget(s) from "${page.name}"? This cannot be undone.`)) {
            page.widgets = [];
            selectedWidgetId = null;
            rebuildWidgetsIndex();
            renderCanvas();
            renderPropertiesPanel();
            scheduleSnippetUpdate();
            sidebarStatus.textContent = `Cleared all widgets from "${page.name}".`;
        }
    };
}

saveLayoutBtn.onclick = async () => {
    const body = getPagesPayload();
    console.log("Saving layout:", body);
    console.log("Pages:", body.pages?.length, "widgets:", body.pages?.reduce((sum, p) => sum + (p.widgets?.length || 0), 0));
    try {
        const resp = await fetch("/api/reterminal_dashboard/layout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        console.log("Save response status:", resp.status, resp.ok);
        if (!resp.ok) {
            const errText = await resp.text();
            console.error("Save failed:", errText);
            sidebarStatus.textContent = "Failed to save layout via API.";
            return;
        }
        const result = await resp.json();
        console.log("Save successful:", result);
        sidebarStatus.textContent = "Layout saved.";
        scheduleSnippetUpdate();
    } catch (err) {
        console.error("Save error:", err);
        sidebarStatus.textContent = "Failed to save layout (network error).";
    }
};

if (generateSnippetBtn) {
    generateSnippetBtn.addEventListener("click", async () => {
        await updateSnippet(true);
    });
}

copySnippetBtn.onclick = async () => {
    const text = snippetBox.value || "";
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            sidebarStatus.textContent = "Snippet copied to clipboard.";
        } else {
            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.style.position = "fixed";
            textarea.style.left = "-999999px";
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand("copy");
                sidebarStatus.textContent = "Snippet copied to clipboard.";
            } catch {
                sidebarStatus.textContent = "Unable to copy snippet. Try selecting and copying manually.";
            }
            document.body.removeChild(textarea);
        }
    } catch {
        sidebarStatus.textContent = "Unable to copy snippet.";
    }
};

fullscreenSnippetBtn.onclick = () => {
    // Use a textarea for editing if it doesn't exist, otherwise update its value
    let textarea = snippetFullscreenContent.querySelector("textarea");
    if (!textarea) {
        snippetFullscreenContent.innerHTML = ""; // Clear existing content
        textarea = document.createElement("textarea");
        textarea.style.width = "100%";
        textarea.style.height = "calc(100vh - 100px)";
        textarea.style.fontFamily = "monospace";
        textarea.style.padding = "10px";
        textarea.style.boxSizing = "border-box";
        snippetFullscreenContent.appendChild(textarea);

        // Add a save/update button to the modal footer if not present
        const footer = snippetFullscreenModal.querySelector(".modal-footer");
        if (footer && !footer.querySelector("#fullscreenUpdateBtn")) {
            const updateBtn = document.createElement("button");
            updateBtn.id = "fullscreenUpdateBtn";
            updateBtn.className = "btn btn-primary";
            updateBtn.textContent = "Update Layout from YAML";
            updateBtn.style.marginRight = "10px";
            updateBtn.onclick = () => {
                snippetBox.value = textarea.value;
                updateLayoutBtn.click(); // Trigger the existing update logic
                snippetFullscreenModal.classList.add("hidden");
            };
            footer.insertBefore(updateBtn, footer.firstChild);
        }
    }
    textarea.value = snippetBox.value || "";
    snippetFullscreenModal.classList.remove("hidden");
};

snippetFullscreenClose.onclick = () => {
    snippetFullscreenModal.classList.add("hidden");
};

// ============================================================================
// Page Settings Modal Functions
// CRITICAL: These functions must exist or JavaScript will crash on page load
// ============================================================================
function closePageSettingsModal() {
    const modal = document.getElementById("pageSettingsModal");
    if (modal) modal.classList.add("hidden");
    currentPageSettingsTarget = null;
}

function openPageSettingsModal(page) {
    currentPageSettingsTarget = page;
    const modal = document.getElementById("pageSettingsModal");
    const nameInput = document.getElementById("pageSettingsName");
    const refreshInput = document.getElementById("pageSettingsRefresh");

    if (nameInput) nameInput.value = page.name || "";
    if (refreshInput) refreshInput.value = (page.refresh_s !== undefined && page.refresh_s !== null) ? page.refresh_s : "";

    if (modal) modal.classList.remove("hidden");
}

function savePageSettings() {
    if (!currentPageSettingsTarget) return;

    const nameInput = document.getElementById("pageSettingsName");
    const refreshInput = document.getElementById("pageSettingsRefresh");

    if (nameInput) {
        currentPageSettingsTarget.name = nameInput.value || "Page";
    }

    if (refreshInput) {
        const val = refreshInput.value.trim();
        if (val === "") {
            currentPageSettingsTarget.refresh_s = null;
        } else {
            const num = parseInt(val, 10);
            currentPageSettingsTarget.refresh_s = (num >= 0) ? num : null;
        }
    }

    renderPagesSidebar();
    scheduleSnippetUpdate();
    closePageSettingsModal();
}

const pageSettingsClose = document.getElementById("pageSettingsClose");
const pageSettingsSave = document.getElementById("pageSettingsSave");
if (pageSettingsClose) {
    pageSettingsClose.addEventListener("click", closePageSettingsModal);
}
if (pageSettingsSave) {
    pageSettingsSave.addEventListener("click", savePageSettings);
}

// ============================================================================
// Device Settings Modal Functions
// ============================================================================



async function loadLayoutFromBackend() {
    console.log("Loading layout from backend...");
    const apiBase = hasHaBackend() ? HA_API_BASE : "/api/reterminal_dashboard";

    try {
        const resp = await fetch(`${apiBase}/layout`);
        console.log("Load response status:", resp.status, resp.ok);
        if (!resp.ok) {
            console.warn("Load failed, initializing default layout");
            initDefaultLayout();
            return;
        }
        const data = await resp.json();
        console.log("Loaded layout:", data);
        console.log("Pages:", data.pages?.length, "widgets:", data.pages?.reduce((sum, p) => sum + (p.widgets?.length || 0), 0));
        pages = data.pages || [];
        currentPageIndex = data.current_page || 0;
        if (!pages.length) {
            console.warn("No pages in loaded layout, initializing default");
            initDefaultLayout();
            return;
        }
        rebuildWidgetsIndex();
        renderPagesSidebar();
        renderCanvas();
        renderPropertiesPanel();
        console.log("Layout loaded successfully");
    } catch (err) {
        console.error("Load error:", err);
        initDefaultLayout();
    }
}

loadLayoutFromBackend().then(() => {
    updateSnippet(true);
    loadHaEntitiesIfNeeded().catch(err => {
        console.warn("Entity loading failed during init:", err);
    });
});
