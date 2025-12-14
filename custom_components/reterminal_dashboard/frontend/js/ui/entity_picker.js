// Entity Picker UI
// Ported from editor.js

function openEntityPickerForWidget(widget, inputEl, callback) {
    if (typeof hasHaBackend !== 'function' || !hasHaBackend()) {
        console.warn("Entity Picker: No HA backend detected.");
        return;
    }

    const container = document.getElementById("propertiesPanel") || document.body;
    const existing = document.querySelector(".entity-picker-overlay");
    if (existing) {
        existing.remove();
    }

    const overlay = document.createElement("div");
    overlay.className = "entity-picker-overlay";

    const header = document.createElement("div");
    header.className = "entity-picker-header";
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
    list.className = "entity-picker-list";

    overlay.appendChild(headerWrap);
    overlay.appendChild(searchRow);
    overlay.appendChild(list);
    container.appendChild(overlay);

    function renderList(entities) {
        list.innerHTML = "";
        if (!entities || entities.length === 0) {
            const empty = document.createElement("div");
            empty.style.color = "var(--muted)";
            empty.style.fontSize = "var(--fs-xs)";
            empty.textContent = "No entities match.";
            list.appendChild(empty);
            return;
        }
        entities.forEach((e) => {
            const row = document.createElement("div");
            row.className = "entity-picker-row";

            const name = document.createElement("div");
            name.className = "entity-picker-name";
            name.textContent = e.name || e.entity_id;

            const meta = document.createElement("div");
            meta.className = "entity-picker-meta";
            meta.textContent = `${e.entity_id} · ${e.domain}`;

            row.appendChild(name);
            row.appendChild(meta);

            row.addEventListener("click", () => {
                // If callback provided, call it with entity_id
                if (callback) {
                    callback(e.entity_id);
                }
                
                // Update input element if provided
                if (inputEl) {
                    inputEl.value = e.entity_id;
                }
                
                // Update widget if provided
                if (widget && window.AppState) {
                    // Update entity_id and title
                    window.AppState.updateWidget(widget.id, {
                        entity_id: e.entity_id,
                        title: e.name || e.entity_id || ""
                    });

                    // Automate Graph settings based on attributes
                    if (widget.type === "graph" && e.attributes) {
                        const attrs = e.attributes;
                        const updates = {};
                        if (attrs.unit_of_measurement === "%") {
                            if (!widget.props.min_value) updates.min_value = "0";
                            if (!widget.props.max_value) updates.max_value = "100";
                        }
                        if (attrs.min !== undefined && !widget.props.min_value) updates.min_value = String(attrs.min);
                        if (attrs.max !== undefined && !widget.props.max_value) updates.max_value = String(attrs.max);

                        if (Object.keys(updates).length > 0) {
                            const newProps = { ...widget.props, ...updates };
                            window.AppState.updateWidget(widget.id, { props: newProps });
                        }
                    }

                    // Automate Unit for Sensor Text
                    if (widget.type === "sensor_text" && e.attributes && e.attributes.unit_of_measurement) {
                        const newProps = { ...widget.props, unit: e.attributes.unit_of_measurement };
                        window.AppState.updateWidget(widget.id, { props: newProps });
                    }
                }
                
                overlay.remove();
            });

            list.appendChild(row);
        });
    }

    // Load entities using global fetchEntityStates from ha_api.js
    if (typeof fetchEntityStates === 'function') {
        fetchEntityStates().then((entities) => {
            if (!entities || entities.length === 0) {
                renderList([]);
                return;
            }

            function applyFilter() {
                const q = (searchInput.value || "").toLowerCase();
                const dom = domainSelect.value;
                const filtered = entities.filter((e) => {
                    // Extract domain from entity_id if not present
                    const domain = e.domain || e.entity_id.split('.')[0];

                    if (dom !== "all" && domain !== dom) {
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

            // Initial render
            applyFilter();
        });
    } else {
        console.error("fetchEntityStates not found. Ensure ha_api.js is loaded.");
        renderList([]);
    }
}

// Expose globally
window.openEntityPickerForWidget = openEntityPickerForWidget;
