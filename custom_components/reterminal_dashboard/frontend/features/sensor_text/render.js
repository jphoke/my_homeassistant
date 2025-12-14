(() => {
    const render = (el, widget, { getColorStyle }) => {
        const props = widget.props || {};
        const entityId = widget.entity_id || "";
        const title = widget.title || "";
        const format = props.value_format || "label_value";
        const precision = parseInt(props.precision, 10);
        const unitProp = props.unit || "";
        const labelFontSize = props.label_font_size || 14;
        const valueFontSize = props.value_font_size || 20;
        const fontFamily = (props.font_family || "Roboto") + ", sans-serif";
        const fontWeight = String(props.font_weight || 400);
        const fontStyle = props.italic ? "italic" : "normal";
        const colorStyle = getColorStyle(props.color);

        let displayValue = "--";
        let displayUnit = unitProp;

        // Try to get real state
        if (window.AppState && window.AppState.entityStates && entityId) {
            const state = window.AppState.entityStates[entityId];
            if (state !== undefined && state !== null) {
                const strState = String(state);
                // Try to parse number and unit if not provided manually
                const match = strState.match(/^([-+]?\d*\.?\d+)(.*)$/);
                if (match) {
                    const val = parseFloat(match[1]);
                    const extractedUnit = match[2] || "";
                    if (!isNaN(val)) {
                        if (!isNaN(precision) && precision >= 0) {
                            displayValue = val.toFixed(precision);
                        } else {
                            displayValue = val.toString();
                        }
                        if (!displayUnit) displayUnit = extractedUnit;
                    } else {
                        displayValue = strState;
                    }
                } else {
                    displayValue = strState;
                }
            }
        } else if (!entityId) {
            displayValue = "--";
        }

        // Full display value with unit
        const fullValue = `${displayValue}${displayUnit}`.trim();

        // Clear element
        el.innerHTML = "";

        // Default Alignment for container
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";

        // Alignment Helper
        const applyAlign = (align, element) => {
            if (!align) return;
            if (align.includes("LEFT")) element.style.textAlign = "left";
            else if (align.includes("RIGHT")) element.style.textAlign = "right";
            else element.style.textAlign = "center";
        };

        const applyFlexAlign = (align, element) => {
            if (!align) return;
            if (align.includes("LEFT")) element.style.justifyContent = "flex-start";
            else if (align.includes("RIGHT")) element.style.justifyContent = "flex-end";
            else element.style.justifyContent = "center";

            if (align.includes("TOP")) element.style.alignItems = "flex-start";
            else if (align.includes("BOTTOM")) element.style.alignItems = "flex-end";
            else element.style.alignItems = "center";
        };

        applyFlexAlign(props.text_align || "TOP_LEFT", el);

        // Create body element
        const body = document.createElement("div");
        body.style.color = colorStyle;
        body.style.fontFamily = fontFamily;
        body.style.fontWeight = fontWeight;
        body.style.fontStyle = fontStyle;

        if (format === "label_value" && title) {
            // Label and value on same line
            body.style.display = "flex";
            body.style.alignItems = "baseline";
            body.style.gap = "4px";

            const labelSpan = document.createElement("span");
            labelSpan.style.fontSize = `${labelFontSize}px`;
            labelSpan.textContent = title + ":";

            const valueSpan = document.createElement("span");
            valueSpan.style.fontSize = `${valueFontSize}px`;
            valueSpan.textContent = fullValue;

            const align = props.label_align || props.text_align || "TOP_LEFT";
            if (align.includes("CENTER")) {
                body.style.justifyContent = "center";
            } else if (align.includes("RIGHT")) {
                body.style.justifyContent = "flex-end";
            } else {
                body.style.justifyContent = "flex-start";
            }

            body.appendChild(labelSpan);
            body.appendChild(valueSpan);
        } else if (format === "label_newline_value" && title) {
            // Label on one line, value on next line (column layout)
            body.style.display = "flex";
            body.style.flexDirection = "column";
            body.style.gap = "2px";
            body.style.width = "100%";

            const labelDiv = document.createElement("div");
            labelDiv.style.fontSize = `${labelFontSize}px`;
            labelDiv.textContent = title;
            applyAlign(props.label_align || props.text_align || "TOP_LEFT", labelDiv);

            const valueDiv = document.createElement("div");
            valueDiv.style.fontSize = `${valueFontSize}px`;
            valueDiv.textContent = fullValue;
            applyAlign(props.value_align || props.text_align || "TOP_LEFT", valueDiv);

            body.appendChild(labelDiv);
            body.appendChild(valueDiv);
        } else if (format === "value_label" && title) {
            // Value first, then label
            body.style.display = "flex";
            body.style.alignItems = "baseline";
            body.style.gap = "4px";

            const valueSpan = document.createElement("span");
            valueSpan.style.fontSize = `${valueFontSize}px`;
            valueSpan.textContent = fullValue;

            const labelSpan = document.createElement("span");
            labelSpan.style.fontSize = `${labelFontSize}px`;
            labelSpan.textContent = title;

            body.appendChild(valueSpan);
            body.appendChild(labelSpan);
        } else if (format === "label_only") {
            body.style.fontSize = `${labelFontSize}px`;
            body.textContent = title;
            applyAlign(props.text_align || "TOP_LEFT", body);
        } else {
            // value_only or default
            body.style.fontSize = `${valueFontSize}px`;
            body.textContent = fullValue;
            applyAlign(props.value_align || props.text_align || "TOP_LEFT", body);
        }

        el.appendChild(body);
    };

    // Register with FeatureRegistry - try immediately and with delay for HA loading
    const registerFeature = () => {
        if (window.FeatureRegistry) {
            window.FeatureRegistry.register("sensor_text", { render });
            return true;
        }
        return false;
    };

    if (!registerFeature()) {
        setTimeout(() => {
            if (!registerFeature()) {
                console.error("[sensor_text/render.js] FeatureRegistry not found!");
            }
        }, 100);
    }
})();
