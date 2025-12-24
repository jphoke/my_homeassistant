(() => {
    const render = (el, widget, { getColorStyle }) => {
        const props = widget.props || {};
        const fgColor = getColorStyle(props.color || "black");
        const bgColor = getColorStyle(props.bg_color || "gray");
        const borderWidth = props.border_width || 2;

        el.innerHTML = "";
        el.style.display = "flex";
        el.style.alignItems = "center"; // Vertical center
        // el.style.position = "relative";

        // Track container
        const trackC = document.createElement("div");
        trackC.style.width = "100%";
        trackC.style.height = "30%"; // Track is thinner than widget
        trackC.style.backgroundColor = bgColor;
        trackC.style.borderRadius = "10px";
        trackC.style.position = "relative";

        el.appendChild(trackC);

        const min = props.min || 0;
        const max = props.max || 100;
        const val = props.value !== undefined ? props.value : 30;
        const range = max - min;
        const pct = Math.max(0, Math.min(100, ((val - min) / (range || 1)) * 100));

        // Indicator (Active part of track)
        const indicator = document.createElement("div");
        indicator.style.position = "absolute";
        indicator.style.left = "0";
        indicator.style.top = "0";
        indicator.style.height = "100%";
        indicator.style.width = `${pct}%`;
        indicator.style.backgroundColor = fgColor;
        indicator.style.borderRadius = "10px";
        trackC.appendChild(indicator);

        // Knob
        const knob = document.createElement("div");
        const knobSize = widget.height * 0.8;
        knob.style.width = `${knobSize}px`;
        knob.style.height = `${knobSize}px`;
        knob.style.backgroundColor = fgColor;
        knob.style.border = `${borderWidth}px solid white`;
        knob.style.borderRadius = "50%";
        knob.style.position = "absolute";
        // Center knob on the end of the indicator
        // calculate offset in px
        // Use calc for simplicity: left: calc(pct% - halfKnob)
        knob.style.left = `calc(${pct}% - ${knobSize / 2}px)`;
        knob.style.top = `calc(50% - ${knobSize / 2}px)`;

        trackC.appendChild(knob);
    };

    if (window.FeatureRegistry) {
        window.FeatureRegistry.register("lvgl_slider", { render });
    }
})();
