// ============================================================================
// DEVICE HARDWARE PROFILES
// ============================================================================
// Complete hardware configuration for each supported device.
// Used to generate all hardware-related YAML sections (sensors, buttons, etc.)
// ============================================================================

const DEVICE_PROFILES = {
    reterminal_e1001: {
        name: "reTerminal E1001 (Monochrome)",
        displayModel: "7.50inv2",
        displayPlatform: "waveshare_epaper",
        pins: {
            display: { cs: "GPIO10", dc: "GPIO11", reset: "GPIO12", busy: "GPIO13" },
            i2c: { sda: "GPIO19", scl: "GPIO20" },
            spi: { clk: "GPIO7", mosi: "GPIO9" },
            batteryEnable: "GPIO21",
            batteryAdc: "GPIO1",
            buzzer: "GPIO45",
            buttons: { left: "GPIO5", right: "GPIO4", refresh: "GPIO3" }
        },
        battery: {
            attenuation: "12db",
            multiplier: 2.0,
            calibration: { min: 3.27, max: 4.15 }
        },
        features: {
            psram: true,
            buzzer: true,
            buttons: true,
            sht4x: true
        }
    },
    reterminal_e1002: {
        name: "reTerminal E1002 (6-Color)",
        displayModel: "Seeed-reTerminal-E1002",
        displayPlatform: "epaper_spi",
        pins: {
            display: { cs: "GPIO10", dc: "GPIO11", reset: "GPIO12", busy: "GPIO13" },
            i2c: { sda: "GPIO19", scl: "GPIO20" },
            spi: { clk: "GPIO7", mosi: "GPIO9" },
            batteryEnable: "GPIO21",
            batteryAdc: "GPIO1",
            buzzer: "GPIO45",
            buttons: { left: "GPIO5", right: "GPIO4", refresh: "GPIO3" }
        },
        battery: {
            attenuation: "12db",
            multiplier: 2.0,
            calibration: { min: 3.27, max: 4.15 }
        },
        features: {
            psram: true,
            buzzer: true,
            buttons: true,
            sht4x: true
        }
    },
    trmnl: {
        name: "TRMNL (ESP32-C3)",
        displayModel: "7.50inv2",
        displayPlatform: "waveshare_epaper",
        pins: {
            display: { cs: "GPIO6", dc: "GPIO5", reset: "GPIO10", busy: "GPIO4" },
            i2c: { sda: "GPIO1", scl: "GPIO2" },
            spi: { clk: "GPIO7", mosi: "GPIO8" },
            batteryEnable: null,
            batteryAdc: "GPIO0",
            buzzer: null,
            buttons: null
        },
        battery: {
            attenuation: "11db",
            multiplier: 2.0,
            calibration: { min: 3.30, max: 4.15 }
        },
        features: {
            psram: false,
            buzzer: false,
            buttons: false,
            sht4x: false
        }
    }
};

// ============================================================================
// HARDWARE SECTION GENERATORS
// ============================================================================

/**
 * Generates globals section with required variables
 * @param {number} defaultRefreshS - Default refresh interval in seconds
 * @param {array} quoteWidgets - Array of quote_rss widgets to generate globals for
 */
function generateGlobalsSection(defaultRefreshS = 900, quoteWidgets = []) {
    const lines = [
        "globals:",
        "  # Navigation & Refresh Logic",
        "  - id: display_page",
        "    type: int",
        "    restore_value: true",
        "    initial_value: '0'",
        "",
        "  # Default page refresh interval (seconds)",
        "  - id: page_refresh_default_s",
        "    type: int",
        "    restore_value: no",
        `    initial_value: '${defaultRefreshS}'`,
        "",
        "  # Current computed refresh interval (seconds)",
        "  - id: page_refresh_current_s",
        "    type: int",
        "    restore_value: no",
        `    initial_value: '${defaultRefreshS}'`,
    ];

    // Add quote widget globals (for storing fetched quote text/author)
    if (quoteWidgets.length > 0) {
        lines.push("");
        lines.push("  # Quote Widget Storage (populated via http_request)");
        for (const w of quoteWidgets) {
            const p = w.props || {};
            const quoteTextId = `quote_text_${w.id}`.replace(/-/g, "_");
            const quoteAuthorId = `quote_author_${w.id}`.replace(/-/g, "_");
            const showAuthor = p.show_author !== false;

            lines.push(`  - id: ${quoteTextId}_global`);
            lines.push(`    type: std::string`);
            lines.push(`    restore_value: no`);
            lines.push(`    initial_value: '"Loading quote..."'`);

            if (showAuthor) {
                lines.push(`  - id: ${quoteAuthorId}_global`);
                lines.push(`    type: std::string`);
                lines.push(`    restore_value: no`);
                lines.push(`    initial_value: '""'`);
            }
        }
    }

    lines.push("");
    return lines;
}


/**
 * Generates I2C section for devices with I2C bus
 */
function generateI2CSection(profile) {
    if (!profile.pins.i2c) return [];
    return [
        "i2c:",
        `  sda: ${profile.pins.i2c.sda}`,
        `  scl: ${profile.pins.i2c.scl}`,
        "  scan: true",
        ""
    ];
}

/**
 * Generates SPI section
 */
function generateSPISection(profile) {
    return [
        "spi:",
        `  clk_pin: ${profile.pins.spi.clk}`,
        `  mosi_pin: ${profile.pins.spi.mosi}`,
        ""
    ];
}

/**
 * Generates PSRAM section for ESP32-S3 devices
 */
function generatePSRAMSection(profile) {
    if (!profile.features.psram) return [];
    return [
        "psram:",
        "  mode: octal",
        "  speed: 80MHz",
        ""
    ];
}

/**
 * Generates output section for battery enable and buzzer
 */
function generateOutputSection(profile) {
    const lines = [];
    if (!profile.pins.batteryEnable && !profile.pins.buzzer) return lines;

    lines.push("output:");
    if (profile.pins.batteryEnable) {
        lines.push("  - platform: gpio");
        lines.push(`    pin: ${profile.pins.batteryEnable}`);
        lines.push("    id: bsp_battery_enable");
    }
    if (profile.pins.buzzer) {
        if (profile.pins.batteryEnable) lines.push("");
        lines.push("  - platform: ledc");
        lines.push(`    pin: ${profile.pins.buzzer}`);
        lines.push("    id: buzzer_output");
    }
    lines.push("");
    return lines;
}

/**
 * Generates RTTTL buzzer section
 */
function generateRTTTLSection(profile) {
    if (!profile.features.buzzer) return [];
    return [
        "rtttl:",
        "  id: reterminal_buzzer",
        "  output: buzzer_output",
        ""
    ];
}

/**
 * Generates unified sensor section (device sensors + widget sensors)
 * @param {object} profile - Device profile
 * @param {array} widgetSensorLines - Additional sensor lines from widgets
 */
function generateSensorSection(profile, widgetSensorLines = []) {
    const lines = [];
    lines.push("sensor:");

    // SHT4x temperature/humidity sensor (E1001/E1002 only)
    if (profile.features.sht4x) {
        lines.push("  # Onboard Temperature & Humidity Sensor");
        lines.push("  - platform: sht4x");
        lines.push("    temperature:");
        lines.push("      name: \"reTerminal Onboard Temperature\"");
        lines.push("      id: reterminal_onboard_temperature");
        lines.push("      accuracy_decimals: 2");
        lines.push("      filters:");
        lines.push("        - round: 2");
        lines.push("    humidity:");
        lines.push("      name: \"reTerminal Onboard Humidity\"");
        lines.push("      id: reterminal_onboard_humidity");
        lines.push("      accuracy_decimals: 2");
        lines.push("      filters:");
        lines.push("        - round: 2");
        lines.push("    address: 0x44");
        lines.push("    update_interval: 60s");
        lines.push("");
    }

    // Battery voltage sensor
    lines.push("  # Battery Voltage");
    lines.push("  - platform: adc");
    lines.push(`    pin: ${profile.pins.batteryAdc}`);
    lines.push("    name: \"Battery Voltage\"");
    lines.push("    id: battery_voltage");
    lines.push("    update_interval: 60s");
    lines.push(`    attenuation: ${profile.battery.attenuation}`);
    lines.push("    accuracy_decimals: 2");
    lines.push("    filters:");
    lines.push(`      - multiply: ${profile.battery.multiplier}`);
    lines.push("      - round: 2");
    lines.push("");

    // Battery level template sensor
    lines.push("  # Battery Level (calculated from voltage)");
    lines.push("  - platform: template");
    lines.push("    name: \"Battery Level\"");
    lines.push("    id: battery_level");
    lines.push("    lambda: 'return id(battery_voltage).state;'");
    lines.push("    unit_of_measurement: \"%\"");
    lines.push("    device_class: battery");
    lines.push("    update_interval: 60s");
    lines.push("    accuracy_decimals: 0");
    lines.push("    filters:");
    lines.push("      - calibrate_linear:");
    lines.push(`          - ${profile.battery.calibration.min} -> 0.0`);
    lines.push(`          - ${profile.battery.calibration.max} -> 100.0`);
    lines.push("      - clamp:");
    lines.push("          min_value: 0");
    lines.push("          max_value: 100");
    lines.push("      - round: 0");
    lines.push("");

    // WiFi signal sensor
    lines.push("  # WiFi Signal Strength");
    lines.push("  - platform: wifi_signal");
    lines.push("    name: \"WiFi Signal Strength\"");
    lines.push("    id: wifi_signal_db");
    lines.push("    update_interval: 60s");
    lines.push("    entity_category: \"diagnostic\"");

    // Add widget sensors (weather forecast, etc.)
    if (widgetSensorLines.length > 0) {
        lines.push("");
        lines.push(...widgetSensorLines);
    }

    lines.push("");
    return lines;
}

/**
 * Generates binary_sensor section for buttons
 */
function generateBinarySensorSection(profile, numPages = 5) {
    if (!profile.features.buttons) return [];
    const lines = [];

    lines.push("binary_sensor:");

    // Left button - previous page
    lines.push("  - platform: gpio");
    lines.push("    id: button_left");
    lines.push("    name: \"reTerminal Button Left\"");
    lines.push("    pin:");
    lines.push(`      number: ${profile.pins.buttons.left}`);
    lines.push("      mode: INPUT_PULLUP");
    lines.push("      inverted: true");
    lines.push("    on_press:");
    lines.push("      then:");
    lines.push("        - lambda: |-");
    lines.push("            if (id(display_page) > 0) {");
    lines.push("              id(display_page) -= 1;");
    lines.push("            }");
    lines.push("        - component.update: epaper_display");
    lines.push("");

    // Right button - next page
    lines.push("  - platform: gpio");
    lines.push("    id: button_right");
    lines.push("    name: \"reTerminal Button Right\"");
    lines.push("    pin:");
    lines.push(`      number: ${profile.pins.buttons.right}`);
    lines.push("      mode: INPUT_PULLUP");
    lines.push("      inverted: true");
    lines.push("    on_press:");
    lines.push("      then:");
    lines.push("        - lambda: |-");
    lines.push(`            if (id(display_page) < ${numPages - 1}) {`);
    lines.push("              id(display_page) += 1;");
    lines.push("            }");
    lines.push("        - component.update: epaper_display");
    lines.push("");

    // Refresh button
    lines.push("  - platform: gpio");
    lines.push("    id: button_refresh");
    lines.push("    name: \"reTerminal Button Refresh\"");
    lines.push("    pin:");
    lines.push(`      number: ${profile.pins.buttons.refresh}`);
    lines.push("      mode: INPUT_PULLUP");
    lines.push("      inverted: true");
    lines.push("    on_press:");
    lines.push("      then:");
    lines.push("        - component.update: epaper_display");
    lines.push("");

    return lines;
}

/**
 * Generates button section for buzzer tones and HA page control
 */
function generateButtonSection(profile, numPages = 5) {
    const lines = [];
    lines.push("button:");

    // Buzzer tones (E1001/E1002 only)
    if (profile.features.buzzer) {
        lines.push("  # Buzzer Sounds");
        lines.push("  - platform: template");
        lines.push("    name: \"Play Beep Short\"");
        lines.push("    icon: \"mdi:bell-ring\"");
        lines.push("    on_press:");
        lines.push("      - rtttl.play: \"beep:d=32,o=5,b=200:16e6\"");
        lines.push("");
        lines.push("  - platform: template");
        lines.push("    name: \"Play Beep OK\"");
        lines.push("    icon: \"mdi:check-circle-outline\"");
        lines.push("    on_press:");
        lines.push("      - rtttl.play: \"ok:d=16,o=5,b=200:e6\"");
        lines.push("");
        lines.push("  - platform: template");
        lines.push("    name: \"Play Beep Error\"");
        lines.push("    icon: \"mdi:alert-circle-outline\"");
        lines.push("    on_press:");
        lines.push("      - rtttl.play: \"error:d=16,o=5,b=200:c6\"");
        lines.push("");
        lines.push("  - platform: template");
        lines.push("    name: \"Play Star Wars\"");
        lines.push("    icon: \"mdi:music-note\"");
        lines.push("    on_press:");
        lines.push("      - rtttl.play: \"StarWars:d=4,o=5,b=45:32p,32f,32f,32f,8a#.,8f.6,32d#,32d,32c,8a#.6,4f.6,32d#,32d,32c,8a#.6,4f.6,32d#,32d,32d#,8c6,32p,32f,32f,32f,8a#.,8f.6,32d#,32d,32c,8a#.6,4f.6,32d#,32d,32c,8a#.6,4f.6,32d#,32d,32d#,8c6\"");
        lines.push("");
    }

    // Page navigation buttons for Home Assistant
    const devicePrefix = profile.features.buttons ? "reterminal" : "trmnl";

    lines.push("  # Page Navigation (Home Assistant control)");
    lines.push("  - platform: template");
    lines.push(`    name: "${devicePrefix === 'reterminal' ? 'reTerminal' : 'TRMNL'} Next Page"`);
    lines.push(`    id: ${devicePrefix}_next_page`);
    lines.push("    on_press:");
    lines.push("      - lambda: |-");
    lines.push(`          int pages = ${numPages};`);
    lines.push("          id(display_page) = (id(display_page) + 1) % pages;");
    lines.push("      - component.update: epaper_display");
    lines.push("");

    lines.push("  - platform: template");
    lines.push(`    name: "${devicePrefix === 'reterminal' ? 'reTerminal' : 'TRMNL'} Previous Page"`);
    lines.push(`    id: ${devicePrefix}_prev_page`);
    lines.push("    on_press:");
    lines.push("      - lambda: |-");
    lines.push(`          int pages = ${numPages};`);
    lines.push("          id(display_page) = (id(display_page) - 1 + pages) % pages;");
    lines.push("      - component.update: epaper_display");
    lines.push("");

    lines.push("  - platform: template");
    lines.push(`    name: "${devicePrefix === 'reterminal' ? 'reTerminal' : 'TRMNL'} Refresh Display"`);
    lines.push(`    id: ${devicePrefix}_refresh_display`);
    lines.push("    on_press:");
    lines.push("      - component.update: epaper_display");
    lines.push("");

    // Individual page buttons
    for (let i = 0; i < numPages; i++) {
        lines.push("  - platform: template");
        lines.push(`    name: "${devicePrefix === 'reterminal' ? 'reTerminal' : 'TRMNL'} Go to Page ${i + 1}"`);
        lines.push(`    id: ${devicePrefix}_goto_page_${i}`);
        lines.push("    on_press:");
        lines.push(`      - lambda: 'id(display_page) = ${i};'`);
        lines.push("      - component.update: epaper_display");
        if (i < numPages - 1) lines.push("");
    }

    lines.push("");
    return lines;
}

/**
 * Generates the ESPHome YAML snippet locally based on the current state.
 * @returns {string} The generated YAML string.
 */
function generateSnippetLocally() {
    const payload = AppState.getPagesPayload();
    const pages = payload.pages || [];
    const pagesLocal = pages;
    const lines = [];

    // Global offset for text widgets to match device rendering
    // Adjust this value if text appears misaligned on the e-ink display
    const TEXT_Y_OFFSET = 0;

    // Global offset for rectangle widgets to match device rendering
    // Negative value moves rectangles UP on the display
    const RECT_Y_OFFSET = -15;

    // Helper to wrap widget rendering with conditional logic
    const wrapWithCondition = (lines, w, contentFn) => {
        const p = w.props || {};
        // IMPORTANT: Only use explicit condition_entity, NOT entity_id fallback
        // entity_id is for the widget's data source, NOT for conditional visibility
        const condEntity = w.condition_entity || "";

        // hasSingle: requires condition_entity + non-empty condition_state + operator
        const hasSingle = condEntity && w.condition_state != null && w.condition_state !== "" && w.condition_operator;
        const hasRange = condEntity && (w.condition_min != null || w.condition_max != null);

        if (!hasSingle && !hasRange) {
            contentFn();
            return;
        }

        let safeCondId = condEntity;
        if (condEntity.includes(".")) {
            safeCondId = condEntity.replace(/\./g, "_").replace(/-/g, "_");
        }

        const isNumeric = condEntity.startsWith("sensor.") && !p.is_text_sensor;

        lines.push(`        {`);

        let valExpr = `id(${safeCondId}).state`;
        if (!isNumeric && hasRange) {
            lines.push(`          float cond_val = atof(id(${safeCondId}).state.c_str());`);
            valExpr = `cond_val`;
        } else if (!isNumeric) {
            valExpr = `id(${safeCondId}).state.c_str()`;
        }

        if (hasRange) {
            const parts = [];
            if (w.condition_min) parts.push(`${valExpr} > ${w.condition_min}`);
            if (w.condition_max) parts.push(`${valExpr} < ${w.condition_max}`);

            if (parts.length > 0) {
                lines.push(`          if (${parts.join(" && ")}) {`);
            } else {
                lines.push(`          if (true) {`);
            }
        } else {
            const op = w.condition_operator || "==";
            const state = w.condition_state;
            if (["<", ">", "<=", ">="].includes(op)) {
                lines.push(`          if (${valExpr} ${op} ${state}) {`);
            } else {
                if (isNumeric) {
                    lines.push(`          if (${valExpr} ${op} ${state}) {`);
                } else {
                    if (op === "==") {
                        lines.push(`          if (id(${safeCondId}).state == "${state}") {`);
                    } else {
                        lines.push(`          if (id(${safeCondId}).state != "${state}") {`);
                    }
                }
            }
        }

        contentFn();

        lines.push(`          }`);
        lines.push(`        }`);
    };

    const getCondProps = (w) => {
        const ce = w.condition_entity || "";
        const co = w.condition_operator || "";
        const cs = w.condition_state || "";
        const cmin = w.condition_min || "";
        const cmax = w.condition_max || "";
        return `cond_ent:${ce} cond_op:${co} cond_state:${cs} cond_min:${cmin} cond_max:${cmax}`;
    };

    const iconCodes = new Set();
    const textFonts = new Set(); // Stores strings "family|weight|size|italic"
    const definedFontIds = new Set(); // Track font IDs that will be defined in font: section
    const usedFontIds = new Set(); // Track font IDs actually used in lambda code

    // Helper to add font (with italic support)
    const addFont = (family, weight, size, italic = false) => {
        const f = (family || "Roboto");
        const w = parseInt(weight || 400, 10);
        const s = parseInt(size || 20, 10);
        const i = italic ? "1" : "0";
        textFonts.add(`${f}|${w}|${s}|${i}`);
    };

    // Helper to mark a font as used and return its ID
    const useFontId = (fontId) => {
        usedFontIds.add(fontId);
        return fontId;
    };

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
            } else if (t === "weather_icon") {
                // Weather icon needs all possible weather state icons in the font
                // Add all weather-related MDI icon codes
                const weatherIcons = [
                    "F0594", // clear-night
                    "F0590", // cloudy
                    "F0026", // exceptional (alert)
                    "F0591", // fog
                    "F0592", // hail
                    "F0593", // lightning
                    "F067E", // lightning-rainy
                    "F0595", // partlycloudy
                    "F0596", // pouring
                    "F0597", // rainy
                    "F0598", // snowy
                    "F067F", // snowy-rainy
                    "F0599", // sunny
                    "F059D", // windy
                    "F059E", // windy-variant
                ];
                weatherIcons.forEach(code => iconCodes.add(code));
            } else if (t === "battery_icon") {
                // Battery icon needs all battery level icons in the font
                const batteryIcons = [
                    "F0079", // battery (full)
                    "F007A", // battery-10
                    "F007B", // battery-20
                    "F007C", // battery-30
                    "F007D", // battery-40
                    "F007E", // battery-50
                    "F007F", // battery-60
                    "F0080", // battery-70
                    "F0081", // battery-80
                    "F0082", // battery-90 / battery-outline
                    "F0083", // battery-alert
                ];
                batteryIcons.forEach(code => iconCodes.add(code));
                // Battery icon also uses a custom font size for the percentage label
                addFont("Roboto", 400, p.font_size || 12);
            } else if (t === "text" || t === "label") {
                addFont(p.font_family, p.font_weight, p.font_size || p.size, !!p.italic);
            } else if (t === "sensor_text") {
                addFont(p.font_family, p.font_weight, p.label_font_size || p.label_font, !!p.italic);
                addFont(p.font_family, p.font_weight, p.value_font_size || p.value_font, !!p.italic);
            } else if (t === "datetime") {
                // Datetime uses specific sizes
                addFont(p.font_family, 700, p.time_font_size, !!p.italic);
                addFont(p.font_family, 400, p.date_font_size, !!p.italic);
            } else if (t === "quote_rss") {
                // Quote/RSS widget uses quote and author font sizes
                // Quote can be italic, author typically not
                // Note: italic_quote defaults to true (matching lambda generation)
                const italicQuote = p.italic_quote !== false;
                const baseSize = parseInt(p.quote_font_size || 18, 10);
                addFont(p.font_family, p.font_weight, baseSize, italicQuote);

                // Add fallback fonts if auto-scale is enabled
                if (p.auto_scale) {
                    addFont(p.font_family, p.font_weight, Math.max(8, Math.floor(baseSize * 0.75)), italicQuote);
                    addFont(p.font_family, p.font_weight, Math.max(8, Math.floor(baseSize * 0.50)), italicQuote);
                }

                if (p.show_author !== false) {
                    addFont(p.font_family, p.font_weight, p.author_font_size || 14, false);
                }
            } else if (t === "weather_forecast") {
                // Weather forecast needs weather icons and specific fonts
                const weatherIcons = [
                    "F0594", "F0590", "F0026", "F0591", "F0592", "F0593", "F067E",
                    "F0595", "F0596", "F0597", "F0598", "F067F", "F0599", "F059D", "F059E"
                ];
                weatherIcons.forEach(code => iconCodes.add(code));

                // Add fonts for day name and temperature
                const daySize = parseInt(p.day_font_size || 14, 10);
                const tempSize = parseInt(p.temp_font_size || 14, 10);
                const family = p.font_family || "Roboto";

                addFont(family, 700, daySize, false); // Day name (bold)
                addFont(family, 400, tempSize, false); // Temp (regular)
            }
        }
    }

    // Always add fallback fonts (Roboto 12, 14 & 20)
    // font_roboto_400_12 is used for small labels (graph axes, progress bar labels, battery %)
    addFont("Roboto", 400, 12);
    addFont("Roboto", 400, 14);
    addFont("Roboto", 400, 20);

    // Get device model for header
    const headerDeviceModel = getDeviceModel();
    let deviceDisplayName = "reTerminal E1001 (Monochrome)";
    if (headerDeviceModel === "reterminal_e1002") {
        deviceDisplayName = "reTerminal E1002 (6-Color)";
    } else if (headerDeviceModel === "trmnl") {
        deviceDisplayName = "Official TRMNL (ESP32-C3)";
    }

    lines.push("# ============================================================================");
    lines.push("# ESPHome YAML - Generated by reTerminal Dashboard Designer");
    lines.push("# ============================================================================");
    lines.push(`# TARGET DEVICE: ${deviceDisplayName}`);

    // Add device-specific specs
    if (headerDeviceModel === "reterminal_e1002") {
        lines.push("#         - Display: 7.5\" Seeed e-Paper (800x480, 6-Color)");
        lines.push("#         - Battery: Yes (LiPo with ADC on GPIO1)");
        lines.push("#         - Buttons: Yes (3 physical buttons)");
        lines.push("#         - Buzzer: Yes (GPIO45)");
        lines.push("#         - Onboard Sensors: Temperature & Humidity (SHT4x)");
        lines.push("#         - NOTE: Requires ESPHome 2025.11.0+");
    } else if (headerDeviceModel === "trmnl") {
        lines.push("#         - Display: 7.5\" Waveshare e-Paper (800x480, Monochrome)");
        lines.push("#         - Battery: Yes (LiPo with ADC on GPIO0)");
        lines.push("#         - Buttons: None");
        lines.push("#         - Buzzer: None");
    } else {
        lines.push("#         - Display: 7.5\" Waveshare e-Paper (800x480, Monochrome)");
        lines.push("#         - Battery: Yes (LiPo with ADC on GPIO1)");
        lines.push("#         - Buttons: Yes (3 physical buttons)");
        lines.push("#         - Buzzer: Yes (GPIO45)");
        lines.push("#         - Onboard Sensors: Temperature & Humidity (SHT4x)");
    }
    lines.push("# ============================================================================");
    lines.push("#");
    lines.push("# SETUP INSTRUCTIONS:");
    lines.push("#");
    lines.push("# STEP 1: Copy the Material Design Icons font file");
    lines.push("#         - From this repo: font_ttf/materialdesignicons-webfont.ttf");
    lines.push("#         - To ESPHome: /config/esphome/fonts/materialdesignicons-webfont.ttf");
    lines.push("#         (Create the fonts folder if it doesn't exist)");
    lines.push("#");
    lines.push("# STEP 2: Create a new device in ESPHome");
    lines.push("#         - Click \"New Device\"");
    lines.push("#         - Name: reterminal (or your choice)");
    if (headerDeviceModel === "trmnl") {
        lines.push("#         - Select: ESP32-C3");
    } else {
        lines.push("#         - Select: ESP32-S3");
    }
    lines.push("#         - ESPHome will auto-generate a basic config");
    lines.push("#");
    lines.push("# STEP 3: Add this on_boot section to your esphome: section:");
    lines.push("#");
    lines.push("#         esphome:");
    lines.push("#           name: your-device-name");
    lines.push("#           compile_process_limit: 1");
    lines.push("#           on_boot:");
    lines.push("#             priority: 600");
    lines.push("#             then:");
    if (headerDeviceModel !== "trmnl") {
        lines.push("#               - output.turn_on: bsp_battery_enable");
    }
    lines.push("#               - delay: 2s");
    lines.push("#               - component.update: epaper_display");
    lines.push("#               - script.execute: manage_run_and_sleep");
    lines.push("#");
    lines.push("# STEP 4: Paste this ENTIRE snippet after the captive_portal: line");
    lines.push("#         All hardware configuration (sensors, buttons, etc.) is included.");
    lines.push("#         No need to copy from templates - this is self-contained!");
    lines.push("#");
    lines.push("# ============================================================================");
    lines.push("");

    // Output device settings
    lines.push("# ====================================");
    lines.push("# Device Settings (from editor)");
    lines.push("# ====================================");
    lines.push(`# Orientation: ${payload.orientation || 'landscape'}`);
    lines.push(`# Dark Mode: ${payload.dark_mode ? 'enabled' : 'disabled'}`);
    lines.push(`# Sleep Mode: ${payload.sleep_enabled ? 'enabled (' + payload.sleep_start_hour + 'h - ' + payload.sleep_end_hour + 'h)' : 'disabled'}`);
    lines.push(`# Manual Refresh Only: ${payload.manual_refresh_only ? 'enabled' : 'disabled'}`);
    lines.push(`# Deep Sleep: ${payload.deep_sleep_enabled ? 'enabled (' + (payload.deep_sleep_interval || 600) + 's interval)' : 'disabled'}`);
    lines.push("# ====================================");
    lines.push("");

    // Generate Font Section
    const fontLines = [];

    // 1. Text Fonts
    if (textFonts.size > 0) {
        fontLines.push("  # Custom text fonts for widget sizes/weights");
        // Sort fonts for consistent output
        const sortedFonts = Array.from(textFonts).map(s => {
            const [f, w, z, i] = s.split("|");
            return { family: f, weight: parseInt(w), size: parseInt(z), italic: i === "1" };
        }).sort((a, b) => {
            if (a.family !== b.family) return a.family.localeCompare(b.family);
            if (a.weight !== b.weight) return a.weight - b.weight;
            if (a.size !== b.size) return a.size - b.size;
            return (a.italic ? 1 : 0) - (b.italic ? 1 : 0);
        });

        sortedFonts.forEach(font => {
            const familyId = font.family.toLowerCase().replace(/\s+/g, "_");
            const italicSuffix = font.italic ? "_italic" : "";
            const fontId = `font_${familyId}_${font.weight}_${font.size}${italicSuffix}`;
            definedFontIds.add(fontId); // Track this font as defined
            fontLines.push(`  - file:`);
            fontLines.push(`      type: gfonts`);
            fontLines.push(`      family: ${font.family}`);
            fontLines.push(`      weight: ${font.weight}`);
            if (font.italic) {
                fontLines.push(`      italic: true`);
            }
            fontLines.push(`    id: ${fontId}`);
            fontLines.push(`    size: ${font.size}`);
            fontLines.push(`    bpp: 1`);
        });
    }

    // 2. MDI Font Definitions (actual fonts, not comments)
    if (iconCodes.size > 0) {
        const glyphs = Array.from(iconCodes).sort().map(code => {
            // Convert hex F0595 to unicode char
            const charCode = parseInt(code, 16);
            // ESPHome expects actual characters or \U format. 
            // In JS string literal for YAML, we can use \U format.
            return `"\\U000${code}"`;
        }).join(", ");

        fontLines.push("");
        fontLines.push("  # Material Design Icon fonts for icon widgets");

        const sizes = new Set();
        for (const page of pagesLocal) {
            if (!page || !page.widgets) continue;
            for (const w of page.widgets) {
                const wtype = (w.type || "").toLowerCase();
                if (wtype === "icon" || wtype === "weather_icon" || wtype === "battery_icon") {
                    sizes.add(parseInt(w.props?.size || 48, 10));
                } else if (wtype === "weather_forecast") {
                    // Weather forecast uses icon_size property for MDI icons
                    sizes.add(parseInt(w.props?.icon_size || 32, 10));
                }
            }
        }
        if (sizes.size === 0) sizes.add(48);

        Array.from(sizes).sort((a, b) => a - b).forEach(size => {
            const fontId = `font_mdi_${size}`;
            fontLines.push(`  - file: fonts/materialdesignicons-webfont.ttf`);
            fontLines.push(`    id: ${fontId}`);
            fontLines.push(`    size: ${size}`);
            fontLines.push(`    glyphs: [${glyphs}]`);
        });
    }

    if (fontLines.length > 0) {
        lines.push("font:");
        lines.push(...fontLines);
        lines.push("");
    }





    // Collect all QR code widgets
    const qrCodeWidgets = [];
    for (const page of pagesLocal) {
        if (!page || !Array.isArray(page.widgets)) continue;
        for (const w of page.widgets) {
            const t = (w.type || "").toLowerCase();
            if (t === "qr_code") {
                qrCodeWidgets.push(w);
            }
        }
    }

    // Generate qr_code: component declarations
    if (qrCodeWidgets.length > 0) {
        lines.push("qr_code:");
        qrCodeWidgets.forEach(w => {
            const p = w.props || {};
            const value = (p.value || "https://esphome.io").replace(/"/g, '\\"');
            const ecc = p.ecc || "LOW";
            const safeId = `qr_${w.id}`.replace(/-/g, "_");

            lines.push(`  - id: ${safeId}`);
            lines.push(`    value: "${value}"`);
            if (ecc !== "LOW") {
                lines.push(`    ecc: ${ecc}`);
            }
        });
        lines.push("");
    }

    // Collect all static image widgets, deduplicating by path+dimensions
    const staticImageMap = new Map(); // key: "path|widthxheight" -> widget
    for (const page of pagesLocal) {
        if (!page || !Array.isArray(page.widgets)) continue;
        for (const w of page.widgets) {
            const t = (w.type || "").toLowerCase();
            if (t === "image") {
                const path = (w.props?.path || "").trim();
                if (path) {
                    const key = `${path}|${w.width}x${w.height}`;
                    if (!staticImageMap.has(key)) {
                        staticImageMap.set(key, w);
                    }
                }
            }
        }
    }

    // Generate image: component declarations for static images (deduplicated)
    if (staticImageMap.size > 0) {
        lines.push("image:");
        staticImageMap.forEach((w, key) => {
            const p = w.props || {};
            const path = p.path.trim();
            const renderMode = p.render_mode || "Auto";

            // Generate safe ID from path
            const safePath = path.replace(/[^a-zA-Z0-9]/g, "_").replace(/^_+|_+$/g, "").replace(/_+/g, "_");
            const safeId = `img_${safePath}_${w.width}x${w.height}`;

            // Determine type based on render mode
            let imgType = "GRAYSCALE";
            if (renderMode === "Binary") {
                imgType = "BINARY";
            } else if (renderMode === "Grayscale") {
                imgType = "GRAYSCALE";
            } else if (renderMode === "Color (RGB565)") {
                imgType = "RGB565";
            } else if (renderMode === "Auto") {
                // Auto: E1002→RGB565, E1001/TRMNL→BINARY (matches online_image behavior)
                imgType = (getDeviceModel() === "reterminal_e1002") ? "RGB565" : "BINARY";
            }

            lines.push(`  - file: "${path}"`);
            lines.push(`    id: ${safeId}`);
            lines.push(`    resize: ${w.width}x${w.height}`);
            lines.push(`    type: ${imgType}`);
            if (imgType === "BINARY" || imgType === "GRAYSCALE") {
                lines.push(`    dither: FLOYDSTEINBERG`);
            }
        });
        lines.push("");
    }

    // Collect all puppet, online_image, graph, and quote_rss widgets
    const onlineImageWidgets = [];
    const graphWidgets = [];
    const quoteRssWidgetsEarly = [];  // Collected early for globals section
    for (const page of pagesLocal) {
        if (!page || !Array.isArray(page.widgets)) continue;
        for (const w of page.widgets) {
            const t = (w.type || "").toLowerCase();
            if (t === "puppet" || t === "online_image") {
                onlineImageWidgets.push(w);
            } else if (t === "graph") {
                graphWidgets.push(w);
            } else if (t === "quote_rss") {
                quoteRssWidgetsEarly.push(w);
            }
        }
    }


    // Generate online_image: component declarations
    if (onlineImageWidgets.length > 0) {
        lines.push("online_image:");
        onlineImageWidgets.forEach(w => {
            const p = w.props || {};
            const t = (w.type || "").toLowerCase();

            // Handle both Puppet (image_url) and Online Image (url) properties
            const url = (p.url || p.image_url || "").trim();
            const safeId = t === "puppet"
                ? `puppet_${w.id}`.replace(/-/g, "_")
                : `online_image_${w.id}`.replace(/-/g, "_");

            // Format defaults to PNG (uppercase) as per ESPHome requirements
            let format = (p.format || "PNG").toUpperCase();
            if (format === "JPG") format = "JPEG"; // ESPHome expects JPEG not JPG

            // Determine type based on render mode
            const renderMode = p.render_mode || "Auto";
            let imgType = "GRAYSCALE";

            if (renderMode === "Binary") {
                imgType = "BINARY";
            } else if (renderMode === "Grayscale") {
                imgType = "GRAYSCALE";
            } else if (renderMode === "Color (RGB565)") {
                imgType = "RGB565";
            } else {
                // Auto defaults: RGB565 for Color E1002, BINARY for Monochrome E1001/TRMNL
                imgType = (getDeviceModel() === "reterminal_e1002") ? "RGB565" : "BINARY";
            }

            // Convert interval_s to ESPHome format (e.g., 100 -> "100s")
            let updateInterval = "never";
            if (p.interval_s && p.interval_s > 0) {
                updateInterval = `${p.interval_s}s`;
            }

            lines.push(`  - id: ${safeId}`);
            lines.push(`    url: "${url}"`);
            lines.push(`    format: ${format}`);
            lines.push(`    type: ${imgType}`);

            // Only add resize for non-BINARY types (User request: simpler memory usage)
            if (imgType !== "BINARY") {
                lines.push(`    resize: ${w.width}x${w.height}`);
            }

            lines.push(`    update_interval: ${updateInterval}`);

            // Add dithering for monochrome displays (BINARY and GRAYSCALE)
            // FLOYDSTEINBERG provides best quality for e-paper displays
            if (imgType === "BINARY" || imgType === "GRAYSCALE") {
                lines.push(`    dither: FLOYDSTEINBERG`);
            }

            lines.push(`    on_download_finished:`);
            lines.push(`      then:`);
            lines.push(`        - component.update: epaper_display`);
            lines.push(`    on_error:`);
            lines.push(`      then:`);
            lines.push(`        - component.update: epaper_display`);
        });
        lines.push("");
    }

    // Generate graph: component declarations
    if (graphWidgets.length > 0) {
        lines.push("graph:");
        graphWidgets.forEach(w => {
            const p = w.props || {};
            const safeId = `graph_${w.id}`.replace(/-/g, "_");
            const duration = p.duration || "1h";
            const width = w.width;
            const height = w.height;
            const maxRange = p.max_range ? parseFloat(p.max_range) : null;
            const minRange = p.min_range ? parseFloat(p.min_range) : null;

            // Grid settings: use explicit values or compute sensible defaults if grid is enabled
            const gridEnabled = p.grid !== false; // "Show Grid" checkbox
            let xGrid = p.x_grid || "";
            let yGrid = p.y_grid || "";

            // If grid is enabled but x_grid/y_grid are empty, compute defaults
            if (gridEnabled) {
                if (!xGrid) {
                    // Parse duration and compute x_grid as duration/4
                    // E.g., "24h" -> "6h", "1h" -> "15min", "30min" -> "7.5min" (round to "8min")
                    const durationMatch = duration.match(/^(\d+(?:\.\d+)?)(min|h|d)$/);
                    if (durationMatch) {
                        const val = parseFloat(durationMatch[1]);
                        const unit = durationMatch[2];
                        let gridVal = val / 4;

                        if (unit === "h") {
                            if (gridVal >= 1) {
                                xGrid = `${Math.round(gridVal)}h`;
                            } else {
                                xGrid = `${Math.round(gridVal * 60)}min`;
                            }
                        } else if (unit === "min") {
                            xGrid = `${Math.round(gridVal)}min`;
                        } else if (unit === "d") {
                            xGrid = `${Math.round(gridVal * 24)}h`;
                        }
                    } else {
                        xGrid = "1h"; // Fallback
                    }
                }

                if (!yGrid) {
                    // Calculate y_grid based on min/max value range
                    const minVal = parseFloat(p.min_value) || 0;
                    const maxVal = parseFloat(p.max_value) || 100;
                    const range = maxVal - minVal;
                    // Aim for ~4-5 grid lines
                    const step = range / 4;
                    // Round to nice values
                    const niceStep = Math.pow(10, Math.floor(Math.log10(step)));
                    const normalized = step / niceStep;
                    let yGridVal;
                    if (normalized <= 1) yGridVal = niceStep;
                    else if (normalized <= 2) yGridVal = 2 * niceStep;
                    else if (normalized <= 5) yGridVal = 5 * niceStep;
                    else yGridVal = 10 * niceStep;

                    yGrid = String(yGridVal);
                }
            }

            // Convert HA entity_id to safe ESPHome local sensor ID
            // e.g., "sensor.esp_wroom_temp" -> "esp_wroom_temp"
            const entityId = (w.entity_id || "").trim();
            const localSensorId = entityId.replace(/^sensor\./, "").replace(/\./g, "_").replace(/-/g, "_") || "none";

            // Get line styling options
            const lineType = (p.line_type || "SOLID").toUpperCase();
            const lineThickness = parseInt(p.line_thickness || 3, 10);
            const border = p.border !== false;
            const continuous = !!p.continuous;

            lines.push(`  - id: ${safeId}`);
            lines.push(`    duration: ${duration}`);
            lines.push(`    width: ${width}`);
            lines.push(`    height: ${height}`);
            lines.push(`    border: ${border}`);

            // Grid configuration (only output if grid is enabled)
            if (gridEnabled && xGrid) lines.push(`    x_grid: ${xGrid}`);
            if (gridEnabled && yGrid) lines.push(`    y_grid: ${yGrid}`);

            // Traces section (required for ESPHome graph component)
            // This defines the actual data line(s) to be drawn
            lines.push(`    traces:`);
            lines.push(`      - sensor: ${localSensorId}`);
            // ALWAYS output line_thickness - ESPHome default is 1px which is invisible on e-paper
            // Our designer default is 3px which provides good visibility
            lines.push(`        line_thickness: ${lineThickness}`);
            if (lineType !== "SOLID") {
                lines.push(`        line_type: ${lineType}`);
            }
            if (continuous) {
                lines.push(`        continuous: true`);
            }

            // Min/Max value configuration (required for Y-axis scaling)
            // These go after traces in ESPHome YAML
            const minValue = p.min_value;
            const maxValue = p.max_value;
            if (minValue !== undefined && minValue !== null && String(minValue).trim() !== "") {
                lines.push(`    min_value: ${minValue}`);
            }
            if (maxValue !== undefined && maxValue !== null && String(maxValue).trim() !== "") {
                lines.push(`    max_value: ${maxValue}`);
            }

            // Range configuration
            if (maxRange !== null) lines.push(`    max_range: ${maxRange}`);
            if (minRange !== null) lines.push(`    min_range: ${minRange}`);
        });
        lines.push("");
    }

    // Generate deep_sleep: configuration if enabled
    if (payload.deep_sleep_enabled) {
        const interval = payload.deep_sleep_interval || 600;
        lines.push("deep_sleep:");
        lines.push("  id: deep_sleep_1");
        lines.push("  run_duration: 30s");
        lines.push(`  sleep_duration: ${interval}s`);
        lines.push("");
    }

    // ========================================================================
    // HARDWARE CONFIGURATION SECTIONS
    // Generated from device profile - replaces template sensor sections
    // ========================================================================

    const deviceModel = getDeviceModel();
    const profile = DEVICE_PROFILES[deviceModel] || DEVICE_PROFILES.reterminal_e1001;
    const numPages = pagesLocal.length || 5;

    // Generate globals section (required for navigation, refresh, and quote storage)
    lines.push(...generateGlobalsSection(900, quoteRssWidgetsEarly));

    // Generate PSRAM section (ESP32-S3 devices only)
    lines.push(...generatePSRAMSection(profile));

    // Generate http_request section (required for online images and quote fetching)
    lines.push("http_request:");
    lines.push("  verify_ssl: false");
    lines.push("  timeout: 20s");
    lines.push("");

    // Generate interval section for quote widget RSS fetching
    if (quoteRssWidgetsEarly.length > 0) {
        lines.push("interval:");
        for (const w of quoteRssWidgetsEarly) {
            const p = w.props || {};
            const feedUrl = p.feed_url || "https://www.brainyquote.com/link/quotebr.rss";
            const refreshInterval = p.refresh_interval || "1h";
            const quoteTextId = `quote_text_${w.id}`.replace(/-/g, "_");
            const quoteAuthorId = `quote_author_${w.id}`.replace(/-/g, "_");
            const showAuthor = p.show_author !== false;
            // Encode feed URL for the proxy
            const encodedFeedUrl = encodeURIComponent(feedUrl);

            lines.push(`  # Quote widget: ${w.id}`);
            lines.push(`  - interval: ${refreshInterval}`);
            lines.push(`    startup_delay: 30s`);
            lines.push(`    then:`);
            lines.push(`      - if:`);
            lines.push(`          condition:`);
            lines.push(`            wifi.connected:`);
            lines.push(`          then:`);
            lines.push(`            - http_request.get:`);
            lines.push(`                # Fetches from Home Assistant's RSS proxy endpoint`);
            lines.push(`                # Uses homeassistant.local by default - change if your HA uses a different hostname`);
            lines.push(`                url: "http://homeassistant.local:8123/api/reterminal_dashboard/rss_proxy?url=${encodedFeedUrl}&random=true"`);
            lines.push(`                capture_response: true`);
            lines.push(`                on_response:`);
            lines.push(`                  - lambda: |-`);
            lines.push(`                      if (response->status_code == 200) {`);
            lines.push(`                        json::parse_json(body, [](JsonObject root) -> bool {`);
            lines.push(`                          if (root["success"].as<bool>()) {`);
            lines.push(`                            JsonObject quote = root["quote"];`);
            lines.push(`                            std::string text = quote["quote"].as<std::string>();`);
            lines.push(`                            std::string author = quote["author"].as<std::string>();`);
            lines.push(`                            id(${quoteTextId}_global) = text;`);
            if (showAuthor) {
                lines.push(`                            id(${quoteAuthorId}_global) = author;`);
            }
            lines.push(`                            ESP_LOGI("quote", "Fetched: %s - %s", text.c_str(), author.c_str());`);
            lines.push(`                          }`);
            lines.push(`                          return true;`);
            lines.push(`                        });`);
            lines.push(`                        id(epaper_display).update();`);
            lines.push(`                      } else {`);
            lines.push(`                        ESP_LOGW("quote", "Failed to fetch quote, HTTP %d", response->status_code);`);
            lines.push(`                      }`);
            lines.push(`          else:`);
            lines.push(`            - logger.log:`);
            lines.push(`                level: WARN`);
            lines.push(`                format: "Quote fetch skipped - WiFi not connected"`);
        }
        lines.push("");
    }

    // Generate time component (always needed for datetime widgets and refresh logic)
    lines.push("time:");
    lines.push("  - platform: homeassistant");
    lines.push("    id: ha_time");
    lines.push("");

    // Generate I2C section
    lines.push(...generateI2CSection(profile));

    // Generate SPI section
    lines.push(...generateSPISection(profile));

    // Generate output section (battery enable, buzzer)
    lines.push(...generateOutputSection(profile));

    // Generate RTTTL buzzer section
    lines.push(...generateRTTTLSection(profile));

    // ========================================================================
    // SENSOR SECTION (Device + Widget sensors unified)
    // ========================================================================

    // Collect additional widget sensor lines for weather forecast
    const widgetSensorLines = [];

    // Collect weather_forecast widgets
    const weatherForecastWidgets = [];
    for (const page of pagesLocal) {
        if (!page || !Array.isArray(page.widgets)) continue;
        for (const w of page.widgets) {
            const t = (w.type || "").toLowerCase();
            if (t === "weather_forecast") {
                weatherForecastWidgets.push(w);
            }
        }
    }

    // Add graph widget sensors (bridge HA entity to local ESPHome sensor)
    // Use a shared Set to track all added sensor.* entities across widget types
    const addedNumericSensors = new Set();
    if (graphWidgets.length > 0) {
        widgetSensorLines.push("  # Graph Widget Sensors (from Home Assistant)");
        for (const w of graphWidgets) {
            const entityId = (w.entity_id || "").trim();
            if (!entityId || addedNumericSensors.has(entityId)) continue;
            addedNumericSensors.add(entityId);

            // Convert HA entity_id to safe ESPHome local sensor ID
            const localSensorId = entityId.replace(/^sensor\./, "").replace(/\./g, "_").replace(/-/g, "_");

            widgetSensorLines.push(`  - platform: homeassistant`);
            widgetSensorLines.push(`    id: ${localSensorId}`);
            widgetSensorLines.push(`    entity_id: ${entityId}`);
            widgetSensorLines.push(`    internal: true`);
        }
    }

    // Collect sensor_text and progress_bar widgets that use HA sensor entities
    const sensorTextWidgets = [];
    for (const page of pagesLocal) {
        if (!page || !Array.isArray(page.widgets)) continue;
        for (const w of page.widgets) {
            const t = (w.type || "").toLowerCase();
            if (t === "sensor_text" || t === "progress_bar") {
                sensorTextWidgets.push(w);
            }
        }
    }

    // Add sensor_text/progress_bar widget sensors (bridge HA entity to local ESPHome sensor)
    // Only for sensor.* entities (weather.* and text_sensor.* are handled in text_sensor section)
    // Uses shared addedNumericSensors Set to avoid duplicates with graph widgets
    let sensorTextSensorCount = 0;
    for (const w of sensorTextWidgets) {
        const entityId = (w.entity_id || "").trim();
        const p = w.props || {};
        // Skip if no entity, already added (by graph or other sensor_text), local sensor, or not a sensor.* entity
        if (!entityId || addedNumericSensors.has(entityId) || p.is_local_sensor) continue;
        if (!entityId.startsWith("sensor.")) continue; // weather.* and text_sensor.* handled elsewhere
        
        addedNumericSensors.add(entityId);

        // Convert HA entity_id to safe ESPHome local sensor ID
        const localSensorId = entityId.replace(/^sensor\./, "").replace(/\./g, "_").replace(/-/g, "_");

        if (sensorTextSensorCount === 0) {
            widgetSensorLines.push("  # Sensor Text Widget Sensors (from Home Assistant)");
        }
        sensorTextSensorCount++;
        widgetSensorLines.push(`  - platform: homeassistant`);
        widgetSensorLines.push(`    id: ${localSensorId}`);
        widgetSensorLines.push(`    entity_id: ${entityId}`);
        widgetSensorLines.push(`    internal: true`);
    }

    // Add weather forecast numeric sensors to unified sensor block
    if (weatherForecastWidgets.length > 0) {
        widgetSensorLines.push("  # Weather Forecast Sensors (5-day forecast from Home Assistant)");
        for (let day = 0; day < 5; day++) {
            widgetSensorLines.push(`  # Day ${day} forecast`);
            widgetSensorLines.push(`  - platform: homeassistant`);
            widgetSensorLines.push(`    id: weather_high_day${day}`);
            widgetSensorLines.push(`    entity_id: sensor.weather_forecast_day${day}_high`);
            widgetSensorLines.push(`    internal: true`);
            widgetSensorLines.push(`  - platform: homeassistant`);
            widgetSensorLines.push(`    id: weather_low_day${day}`);
            widgetSensorLines.push(`    entity_id: sensor.weather_forecast_day${day}_low`);
            widgetSensorLines.push(`    internal: true`);
        }
    }

    // Generate unified sensor section
    lines.push(...generateSensorSection(profile, widgetSensorLines));

    // Generate binary_sensor section (buttons for E1001/E1002)
    lines.push(...generateBinarySensorSection(profile, numPages));

    // Generate button section (buzzer tones + page navigation)
    lines.push(...generateButtonSection(profile, numPages));

    // ========================================================================
    // TEXT SENSOR SECTION (Widget sensors: quotes, weather conditions)
    // ========================================================================

    // Collect quote_rss widgets
    const quoteRssWidgets = [];
    for (const page of pagesLocal) {
        if (!page || !Array.isArray(page.widgets)) continue;
        for (const w of page.widgets) {
            const t = (w.type || "").toLowerCase();
            if (t === "quote_rss") {
                quoteRssWidgets.push(w);
            }
        }
    }

    // Collect weather entities used by sensor_text and weather_icon widgets
    const weatherEntitiesUsed = new Set();
    // Collect text_sensor entities used by sensor_text widgets
    const textSensorEntitiesUsed = new Set();
    for (const page of pagesLocal) {
        if (!page || !Array.isArray(page.widgets)) continue;
        for (const w of page.widgets) {
            const t = (w.type || "").toLowerCase();
            const entityId = (w.entity_id || "").trim();
            const p = w.props || {};
            if (p.is_local_sensor) continue; // Skip local sensors
            if ((t === "sensor_text" || t === "weather_icon") && entityId.startsWith("weather.")) {
                weatherEntitiesUsed.add(entityId);
            }
            if (t === "sensor_text" && entityId.startsWith("text_sensor.")) {
                textSensorEntitiesUsed.add(entityId);
            }
        }
    }

    // Check if we need text_sensor block
    const needsTextSensors = quoteRssWidgets.length > 0 || weatherForecastWidgets.length > 0 || weatherEntitiesUsed.size > 0 || textSensorEntitiesUsed.size > 0;

    if (needsTextSensors) {
        lines.push("text_sensor:");

        // Add quote widget sensors - using local template sensors (not HA-dependent)
        // These will be populated via http_request from HA's RSS proxy
        if (quoteRssWidgets.length > 0) {
            lines.push("  # Quote/RSS Widget Sensors (local, populated via http_request)");
            for (const w of quoteRssWidgets) {
                const p = w.props || {};
                const quoteTextId = `quote_text_${w.id}`.replace(/-/g, "_");
                const quoteAuthorId = `quote_author_${w.id}`.replace(/-/g, "_");
                const showAuthor = p.show_author !== false;

                lines.push(`  - platform: template`);
                lines.push(`    id: ${quoteTextId}`);
                lines.push(`    name: "Quote Text ${w.id}"`);
                lines.push(`    lambda: 'return id(${quoteTextId}_global);'`);

                if (showAuthor) {
                    lines.push(`  - platform: template`);
                    lines.push(`    id: ${quoteAuthorId}`);
                    lines.push(`    name: "Quote Author ${w.id}"`);
                    lines.push(`    lambda: 'return id(${quoteAuthorId}_global);'`);
                }
            }
            lines.push("");
        }


        // Add weather entity sensors (for weather_icon and sensor_text widgets)
        if (weatherEntitiesUsed.size > 0) {
            lines.push("  # Weather Entity Sensors");
            for (const entityId of weatherEntitiesUsed) {
                const safeId = entityId.replace(/\./g, "_").replace(/-/g, "_");
                lines.push(`  - platform: homeassistant`);
                lines.push(`    id: ${safeId}`);
                lines.push(`    entity_id: ${entityId}`);
                lines.push(`    internal: true`);
            }
            lines.push("");
        }

        // Add text_sensor entity sensors (for sensor_text widgets using text_sensor.* entities)
        if (textSensorEntitiesUsed.size > 0) {
            lines.push("  # Text Sensor Entity Sensors (from Home Assistant)");
            for (const entityId of textSensorEntitiesUsed) {
                const safeId = entityId.replace(/^text_sensor\./, "").replace(/\./g, "_").replace(/-/g, "_");
                lines.push(`  - platform: homeassistant`);
                lines.push(`    id: ${safeId}`);
                lines.push(`    entity_id: ${entityId}`);
                lines.push(`    internal: true`);
            }
            lines.push("");
        }

        // Add weather forecast condition sensors
        if (weatherForecastWidgets.length > 0) {
            lines.push("  # Weather Forecast Condition Sensors");
            for (let day = 0; day < 5; day++) {
                lines.push(`  - platform: homeassistant`);
                lines.push(`    id: weather_cond_day${day}`);
                lines.push(`    entity_id: sensor.weather_forecast_day${day}_condition`);
                lines.push(`    internal: true`);
            }
        }
        lines.push("");
    }

    // ========================================================================
    // HOME ASSISTANT TEMPLATE SENSORS (Instructions only)
    // ========================================================================

    if (weatherForecastWidgets.length > 0) {
        lines.push("# ============================================================================");
        lines.push("# HOME ASSISTANT TEMPLATE SENSORS");
        lines.push("# Add these template sensors to your Home Assistant configuration.yaml:");
        lines.push("# ============================================================================");
        lines.push("#");
        lines.push("# template:");
        lines.push("#   - trigger:");
        lines.push("#       - trigger: state");
        lines.push("#         entity_id: weather.forecast_home  # Replace with your weather entity");
        lines.push("#       - trigger: time_pattern");
        lines.push("#         hours: \"/1\"");
        lines.push("#     action:");
        lines.push("#       - action: weather.get_forecasts");
        lines.push("#         target:");
        lines.push("#           entity_id: weather.forecast_home  # Replace with your weather entity");
        lines.push("#         data:");
        lines.push("#           type: daily");
        lines.push("#         response_variable: forecast_data");
        lines.push("#     sensor:");
        for (let day = 0; day < 5; day++) {
            lines.push(`#       - name: "Weather Forecast Day ${day} High"`);
            lines.push(`#         unique_id: weather_forecast_day${day}_high`);
            lines.push(`#         unit_of_measurement: "°C"`);
            lines.push(`#         state: "{{ forecast_data['weather.forecast_home'].forecast[${day}].temperature | default('N/A') }}"`);
            lines.push(`#       - name: "Weather Forecast Day ${day} Low"`);
            lines.push(`#         unique_id: weather_forecast_day${day}_low`);
            lines.push(`#         unit_of_measurement: "°C"`);
            lines.push(`#         state: "{{ forecast_data['weather.forecast_home'].forecast[${day}].templow | default('N/A') }}"`);
            lines.push(`#       - name: "Weather Forecast Day ${day} Condition"`);
            lines.push(`#         unique_id: weather_forecast_day${day}_condition`);
            lines.push(`#         state: "{{ forecast_data['weather.forecast_home'].forecast[${day}].condition | default('cloudy') }}"`);
        }
        lines.push("#");
        lines.push("# ============================================================================");
        lines.push("");
    }

    // Generate script section with sleep and refresh logic
    const scriptSection = generateScriptSection(payload, pagesLocal);
    lines.push(scriptSection);
    lines.push("");

    lines.push("display:");

    // deviceModel already defined above for hardware profile lookup
    if (deviceModel === "reterminal_e1002") {
        // E1002 color e-paper display configuration (requires ESPHome 2025.11.0+)
        lines.push("  # Device: reTerminal E1002 (6-Color E-Paper)");
        lines.push("  - platform: epaper_spi");
        lines.push("    id: epaper_display");
        lines.push("    model: Seeed-reTerminal-E1002");
        lines.push("    update_interval: never");
    } else if (deviceModel === "trmnl") {
        // Official TRMNL (ESP32-C3) configuration
        lines.push("  # Device: Official TRMNL (ESP32-C3)");
        lines.push("  - platform: waveshare_epaper");
        lines.push("    id: epaper_display");
        lines.push("    model: 7.50inv2");
        lines.push("    cs_pin: GPIO6");
        lines.push("    dc_pin: GPIO5");
        lines.push("    reset_pin:");
        lines.push("      number: GPIO10");
        lines.push("      inverted: false");
        lines.push("    busy_pin:");
        lines.push("      number: GPIO4");
        lines.push("      inverted: true");
        lines.push("    update_interval: never");
    } else {
        // Default / E1001 configuration (Waveshare)
        lines.push("  # Device: reTerminal E1001 (Monochrome E-Paper)");
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
        lines.push("    update_interval: never");
    }

    lines.push("    lambda: |-");
    lines.push("      // Define common colors for widgets");
    if (getDeviceModel() === "reterminal_e1002") {
        // E1002 is a color display - use proper RGBA values (4th param is alpha=0)
        lines.push("      const auto COLOR_ON = Color(0, 0, 0, 0);         // Black");
        lines.push("      const auto COLOR_OFF = Color(255, 255, 255, 0);  // White");
        lines.push("      const auto COLOR_RED = Color(255, 0, 0, 0);");
        lines.push("      const auto COLOR_GREEN = Color(0, 255, 0, 0);");
        lines.push("      const auto COLOR_BLUE = Color(0, 0, 255, 0);");
        lines.push("      const auto COLOR_YELLOW = Color(255, 255, 0, 0);");
    } else {
        // E1001 is a binary display - use 0/1
        lines.push("      Color COLOR_ON = Color(1);");
        lines.push("      Color COLOR_OFF = Color(0);");
    }
    lines.push("      it.fill(COLOR_OFF);");
    lines.push("");
    lines.push("      int page = id(display_page);");

    pages.forEach((page, pageIndex) => {
        lines.push(`      if (page == ${pageIndex}) {`);
        lines.push(`        // page:name "${page.name}"`);
        if (!page.widgets || !page.widgets.length) {
            lines.push("        // No widgets on this page.");
        } else {
            // Helper functions for alignment calculations (shared across all widget types)
            const getAlignX = (align, x, w) => {
                if (align.includes("LEFT")) return x;
                if (align.includes("RIGHT")) return x + w;
                return x + Math.floor(w / 2);
            };

            const getAlignY = (align, y, h) => {
                if (align.includes("TOP")) return y;
                if (align.includes("BOTTOM")) return y + h;
                return y + Math.floor(h / 2);
            };

            // Helper to map color names to ESPHome color constants
            // For E1002 (color display): supports black, white, red, green, blue, yellow
            // For E1001 (B&W display): only COLOR_ON and COLOR_OFF
            const getColorConst = (colorProp) => {
                const c = (colorProp || "black").toLowerCase();
                if (c === "white") return "COLOR_OFF";
                if (getDeviceModel() === "reterminal_e1002") {
                    if (c === "red") return "COLOR_RED";
                    if (c === "green") return "COLOR_GREEN";
                    if (c === "blue") return "COLOR_BLUE";
                    if (c === "yellow") return "COLOR_YELLOW";
                }
                return "COLOR_ON"; // black, gray, or any other falls back to black
            };

            for (const w of page.widgets) {
                wrapWithCondition(lines, w, () => {
                    const t = (w.type || "").toLowerCase();
                    const p = w.props || {};

                    // Add local sensor marker comment for relevant widgets
                    let localMarker = "";
                    if (p.is_local_sensor) {
                        localMarker = " // local: true";
                    }

                    if (t === "text" || t === "label") {
                        const txt = (p.text || w.title || "Text").replace(/"/g, '\\"');
                        if (!txt) return;
                        const fontSize = parseInt(p.font_size || p.size || 12, 10) || 12;
                        const colorProp = p.color || "black";
                        const color = getColorConst(colorProp);
                        const textAlign = p.text_align || "TOP_LEFT";
                        const fontWeight = p.font_weight || 400;
                        const fontFamily = p.font_family || "Roboto";
                        const italic = p.italic ? "true" : "false";
                        const bpp = p.bpp || 1;

                        lines.push(`        // widget:text id:${w.id} type:text x:${w.x} y:${w.y} w:${w.width} h:${w.height} text:"${txt}" font_family:"${fontFamily}" size:${fontSize} weight:${fontWeight} italic:${italic} bpp:${bpp} color:${colorProp} align:${textAlign} ${getCondProps(w)}`);

                        // Only offset X based on alignment, use w.y directly
                        // ESPHome's TextAlign handles vertical positioning semantically
                        const alignX = getAlignX(textAlign, w.x, w.width);

                        const italicSuffix = p.italic ? "_italic" : "";
                        const fontId = `font_${fontFamily.toLowerCase().replace(/\s+/g, '_')}_${fontWeight}_${fontSize}${italicSuffix}`;
                        usedFontIds.add(fontId);
                        lines.push(`        it.printf(${alignX}, ${w.y} + ${TEXT_Y_OFFSET}, id(${fontId}), ${color}, TextAlign::${textAlign}, "${txt}");`);
                    } else if (t === "sensor_text") {
                        const entityId = (w.entity_id || "").trim();
                        const label = (w.title || "").replace(/"/g, '\\"');
                        const valueFormat = p.value_format || "label_value";
                        const labelFontSize = parseInt(p.label_font_size || p.label_font || 14, 10) || 14;
                        const valueFontSize = parseInt(p.value_font_size || p.value_font || 20, 10) || 20;
                        const colorProp = p.color || "black";
                        const color = getColorConst(colorProp);
                        const textAlign = p.text_align || "TOP_LEFT";
                        const labelAlign = p.label_align || textAlign;
                        const valueAlign = p.value_align || textAlign;
                        const precision = parseInt(p.precision !== undefined ? p.precision : -1, 10);
                        const unit = p.unit || "";
                        const fontFamily = p.font_family || "Roboto";
                        const fontWeight = parseInt(p.font_weight || 400, 10);
                        const italic = p.italic ? "true" : "false";

                        lines.push(`        // widget:sensor_text id:${w.id} type:sensor_text x:${w.x} y:${w.y} w:${w.width} h:${w.height} entity:${entityId} title:"${label}" format:${valueFormat} label_font_size:${labelFontSize} value_font_size:${valueFontSize} color:${colorProp} text_align:${textAlign} label_align:${labelAlign} value_align:${valueAlign} precision:${precision} unit:"${unit}" font_family:${fontFamily} font_weight:${fontWeight} italic:${italic} local:${!!p.is_local_sensor} ${getCondProps(w)}`);

                        // Only offset X based on alignment, use w.y directly
                        // ESPHome's TextAlign handles vertical positioning semantically
                        const alignX = getAlignX(textAlign, w.x, w.width);

                        const italicSuffix = p.italic ? "_italic" : "";
                        const labelFontId = `font_${fontFamily.toLowerCase().replace(/\s+/g, '_')}_${fontWeight}_${labelFontSize}${italicSuffix}`;
                        const valueFontId = `font_${fontFamily.toLowerCase().replace(/\s+/g, '_')}_${fontWeight}_${valueFontSize}${italicSuffix}`;
                        usedFontIds.add(labelFontId);
                        usedFontIds.add(valueFontId);

                        // Handle missing entity_id gracefully - show placeholder text instead of invalid id() call
                        if (!entityId) {
                            // No entity configured - show label with placeholder value
                            if (label && (valueFormat === "label_value" || valueFormat === "label_newline_value")) {
                                lines.push(`        it.printf(${alignX}, ${w.y} + ${TEXT_Y_OFFSET}, id(${labelFontId}), ${color}, TextAlign::${textAlign}, "${label}");`);
                                if (valueFormat === "label_newline_value") {
                                    lines.push(`        it.printf(${alignX}, ${w.y} + ${labelFontSize} + 4 + ${TEXT_Y_OFFSET}, id(${valueFontId}), ${color}, TextAlign::${textAlign}, "--");`);
                                } else {
                                    lines.push(`        it.printf(${alignX}, ${w.y} + ${labelFontSize} + ${TEXT_Y_OFFSET}, id(${valueFontId}), ${color}, TextAlign::${textAlign}, "--");`);
                                }
                            } else {
                                lines.push(`        it.printf(${alignX}, ${w.y} + ${TEXT_Y_OFFSET}, id(${valueFontId}), ${color}, TextAlign::${textAlign}, "--");`);
                            }
                            lines.push(`        // WARNING: No entity_id configured for this sensor_text widget`);
                        } else {
                            // Determine if this is a text-based entity (weather, text_sensor) or numeric sensor
                            const isTextEntity = entityId.startsWith("weather.") || entityId.startsWith("text_sensor.") || p.is_text_sensor;
                            const safeEntityId = entityId.replace(/^sensor\./, "").replace(/\./g, "_").replace(/-/g, "_");

                            // Build format specifier and value expression based on entity type
                            let fmtSpec, valueExpr;
                            if (isTextEntity) {
                                // Text-based entity: use %s and .state.c_str()
                                fmtSpec = "%s";
                                valueExpr = `id(${safeEntityId}).state.c_str()`;
                            } else {
                                // Numeric sensor: use precision-based float format
                                fmtSpec = `%.${precision >= 0 ? precision : 1}f%s`;
                                valueExpr = `id(${safeEntityId}).state, "${unit}"`;
                            }

                            // Generate output based on value format
                            if (label && valueFormat === "label_value") {
                                lines.push(`        it.printf(${alignX}, ${w.y} + ${TEXT_Y_OFFSET}, id(${labelFontId}), ${color}, TextAlign::${textAlign}, "${label}");`);
                                if (isTextEntity) {
                                    lines.push(`        it.printf(${alignX}, ${w.y} + ${labelFontSize} + ${TEXT_Y_OFFSET}, id(${valueFontId}), ${color}, TextAlign::${textAlign}, "${fmtSpec}", ${valueExpr});`);
                                } else {
                                    lines.push(`        it.printf(${alignX}, ${w.y} + ${labelFontSize} + ${TEXT_Y_OFFSET}, id(${valueFontId}), ${color}, TextAlign::${textAlign}, "${fmtSpec}", ${valueExpr});`);
                                }
                            } else if (valueFormat === "label_newline_value") {
                                // Label on one line, value on next
                                lines.push(`        it.printf(${alignX}, ${w.y} + ${TEXT_Y_OFFSET}, id(${labelFontId}), ${color}, TextAlign::${textAlign}, "${label}");`);
                                if (isTextEntity) {
                                    lines.push(`        it.printf(${alignX}, ${w.y} + ${labelFontSize} + 4 + ${TEXT_Y_OFFSET}, id(${valueFontId}), ${color}, TextAlign::${textAlign}, "${fmtSpec}", ${valueExpr});`);
                                } else {
                                    lines.push(`        it.printf(${alignX}, ${w.y} + ${labelFontSize} + 4 + ${TEXT_Y_OFFSET}, id(${valueFontId}), ${color}, TextAlign::${textAlign}, "${fmtSpec}", ${valueExpr});`);
                                }
                            } else {
                                // Just value (value_only or fallback)
                                if (isTextEntity) {
                                    lines.push(`        it.printf(${alignX}, ${w.y} + ${TEXT_Y_OFFSET}, id(${valueFontId}), ${color}, TextAlign::${textAlign}, "${fmtSpec}", ${valueExpr});`);
                                } else {
                                    lines.push(`        it.printf(${alignX}, ${w.y} + ${TEXT_Y_OFFSET}, id(${valueFontId}), ${color}, TextAlign::${textAlign}, "${fmtSpec}", ${valueExpr});`);
                                }
                            }
                        }

                    } else if (t === "line") {
                        const strokeWidth = parseInt(p.stroke_width || 3, 10);
                        const colorProp = p.color || "black";
                        const color = getColorConst(colorProp);
                        const orientation = p.orientation || "horizontal";

                        // Use filled_rectangle for lines - simpler and supports thickness
                        // For horizontal: width is w.width (line length), height is strokeWidth
                        // For vertical: width is strokeWidth, height is w.height (line length)

                        let rectW, rectH;

                        if (orientation === "vertical") {
                            rectW = strokeWidth;
                            rectH = w.height;
                        } else {
                            rectW = w.width;
                            rectH = strokeWidth;
                        }

                        lines.push(`        // widget:line id:${w.id} type:line x:${w.x} y:${w.y} w:${rectW} h:${rectH} stroke:${strokeWidth} color:${colorProp} orientation:${orientation}`);
                        lines.push(`        it.filled_rectangle(${w.x}, ${w.y}, ${rectW}, ${rectH}, ${color});`);

                    } else if (t === "shape_rect") {
                        const borderWidth = parseInt(p.border_width || 1, 10);
                        const colorProp = p.color || "black";
                        const color = getColorConst(colorProp);
                        const fill = p.fill;
                        const opacity = parseInt(p.opacity || 100, 10);
                        const isGray = colorProp.toLowerCase() === "gray";
                        const rectY = w.y + RECT_Y_OFFSET;

                        lines.push(`        // widget:shape_rect id:${w.id} type:shape_rect x:${w.x} y:${w.y} w:${w.width} h:${w.height} fill:${fill} border:${borderWidth} opacity:${opacity} color:${colorProp} ${getCondProps(w)}`);

                        if (fill) {
                            if (isGray) {
                                // Gray: use 50% checkerboard dithering pattern
                                lines.push(`        // Gray fill using 50% checkerboard dithering pattern`);
                                lines.push(`        for (int dy = 0; dy < ${w.height}; dy++) {`);
                                lines.push(`          for (int dx = 0; dx < ${w.width}; dx++) {`);
                                lines.push(`            if ((dx + dy) % 2 == 0) {`);
                                lines.push(`              it.draw_pixel_at(${w.x}+dx, ${rectY}+dy, COLOR_ON);`);
                                lines.push(`            }`);
                                lines.push(`          }`);
                                lines.push(`        }`);
                            } else {
                                lines.push(`        it.filled_rectangle(${w.x}, ${rectY}, ${w.width}, ${w.height}, ${color});`);
                            }
                        } else {
                            lines.push(`        it.rectangle(${w.x}, ${rectY}, ${w.width}, ${w.height}, ${color});`);
                            // TODO: Handle border width > 1 for non-filled rects if needed (by drawing multiple rects or using a helper)
                        }

                    } else if (t === "shape_circle") {
                        const borderWidth = parseInt(p.border_width || 1, 10);
                        const colorProp = p.color || "black";
                        const color = getColorConst(colorProp);
                        const fill = p.fill;
                        const opacity = parseInt(p.opacity || 100, 10);
                        const isGray = colorProp.toLowerCase() === "gray";
                        const radius = Math.floor(Math.min(w.width, w.height) / 2);
                        const cx = w.x + radius;
                        const cy = w.y + radius;

                        lines.push(`        // widget:shape_circle id:${w.id} type:shape_circle x:${w.x} y:${w.y} w:${w.width} h:${w.height} fill:${fill} border:${borderWidth} opacity:${opacity} color:${colorProp} ${getCondProps(w)}`);

                        if (fill) {
                            if (isGray) {
                                // Gray: use 50% checkerboard dithering pattern for circle
                                lines.push(`        // Gray circle fill using 50% checkerboard dithering pattern`);
                                lines.push(`        for (int dy = -${radius}; dy <= ${radius}; dy++) {`);
                                lines.push(`          for (int dx = -${radius}; dx <= ${radius}; dx++) {`);
                                lines.push(`            if (dx*dx + dy*dy <= ${radius}*${radius}) {`);
                                lines.push(`              if ((dx + dy) % 2 == 0) {`);
                                lines.push(`                it.draw_pixel_at(${cx}+dx, ${cy}+dy, COLOR_ON);`);
                                lines.push(`              }`);
                                lines.push(`            }`);
                                lines.push(`          }`);
                                lines.push(`        }`);
                            } else {
                                lines.push(`        it.filled_circle(${cx}, ${cy}, ${radius}, ${color});`);
                            }
                        } else {
                            lines.push(`        it.circle(${cx}, ${cy}, ${radius}, ${color});`);
                        }

                    } else if (t === "icon") {
                        const code = (p.code || "F0595").replace(/^0x/i, "");
                        const size = parseInt(p.size || 48, 10);
                        const colorProp = p.color || "black";
                        const color = getColorConst(colorProp);
                        const fontRef = `font_mdi_${size}`;
                        lines.push(`        // widget:icon id:${w.id} type:icon x:${w.x} y:${w.y} w:${w.width} h:${w.height} code:${code} size:${size} color:${colorProp} ${getCondProps(w)}`);
                        lines.push(`        it.print(${w.x}, ${w.y}, id(${fontRef}), ${color}, "\\U000${code}");`);

                    } else if (t === "graph") {
                        const entityId = (w.entity_id || "").trim();
                        const title = (w.title || "").replace(/"/g, '\\"');
                        const duration = p.duration || "1h";
                        const borderEnabled = p.border !== false;
                        const colorProp = p.color || "black";
                        const color = getColorConst(colorProp);
                        const lineType = p.line_type || "SOLID";
                        const lineThickness = parseInt(p.line_thickness || 3, 10);
                        const continuous = !!p.continuous;
                        const minValue = p.min_value || "";
                        const maxValue = p.max_value || "";
                        const minRange = p.min_range || "";
                        const maxRange = p.max_range || "";
                        const safeId = `graph_${w.id}`.replace(/-/g, "_");
                        usedFontIds.add("font_roboto_400_12"); // Graph uses small font for labels

                        // Grid settings: use explicit values or compute sensible defaults if grid is enabled
                        const gridEnabled = p.grid !== false;
                        let xGrid = p.x_grid || "";
                        let yGrid = p.y_grid || "";

                        // If grid is enabled but x_grid/y_grid are empty, compute defaults
                        if (gridEnabled) {
                            if (!xGrid) {
                                // Parse duration
                                const durationMatch = duration.match(/^(\d+(?:\.\d+)?)(min|h|d)$/);
                                if (durationMatch) {
                                    const val = parseFloat(durationMatch[1]);
                                    const unit = durationMatch[2];
                                    let gridVal = val / 4;
                                    if (unit === "h") {
                                        if (gridVal >= 1) xGrid = `${Math.round(gridVal)}h`;
                                        else xGrid = `${Math.round(gridVal * 60)}min`;
                                    } else if (unit === "min") {
                                        xGrid = `${Math.round(gridVal)}min`;
                                    } else if (unit === "d") {
                                        xGrid = `${Math.round(gridVal * 24)}h`;
                                    }
                                } else {
                                    xGrid = "1h"; // Fallback
                                }
                            }

                            if (!yGrid) {
                                // Calculate y_grid based on min/max value range
                                const minVal = parseFloat(minValue) || 0;
                                const maxVal = parseFloat(maxValue) || 100;
                                const range = maxVal - minVal;
                                const step = range / 4;
                                const niceStep = Math.pow(10, Math.floor(Math.log10(step)));
                                const normalized = step / niceStep;
                                let yGridVal;
                                if (normalized <= 1) yGridVal = niceStep;
                                else if (normalized <= 2) yGridVal = 2 * niceStep;
                                else if (normalized <= 5) yGridVal = 5 * niceStep;
                                else yGridVal = 10 * niceStep;
                                yGrid = String(yGridVal);
                            }
                        }

                        lines.push(`        // widget:graph id:${w.id} type:graph x:${w.x} y:${w.y} w:${w.width} h:${w.height} title:"${title}" entity:${entityId} local:${!!p.is_local_sensor} duration:${duration} border:${borderEnabled} color:${colorProp} x_grid:${xGrid} y_grid:${yGrid} line_type:${lineType} line_thickness:${lineThickness} continuous:${continuous} min_value:${minValue} max_value:${maxValue} min_range:${minRange} max_range:${maxRange} ${getCondProps(w)}`);

                        if (entityId) {
                            // Pass color as 4th parameter to set border/grid color (required for e-paper)
                            lines.push(`        it.graph(${w.x}, ${w.y}, id(${safeId}), ${color});`);

                            // Draw Border if enabled
                            if (borderEnabled) {
                                lines.push(`        it.rectangle(${w.x}, ${w.y}, ${w.width}, ${w.height}, ${color});`);
                            }

                            // Draw Grid Lines if configured
                            // Note: ESPHome graph component doesn't draw grid lines automatically on e-paper
                            // We must draw them manually in the lambda

                            // Y-Grid (Horizontal lines)
                            if (yGrid) {
                                // Drawing 4 horizontal grid lines as a default if enabled
                                const ySteps = 4;
                                for (let i = 1; i < ySteps; i++) {
                                    const yOffset = Math.round(w.height * (i / ySteps));
                                    lines.push(`        for (int i = 0; i < ${w.width}; i += 4) {`);
                                    lines.push(`          it.draw_pixel_at(${w.x} + i, ${w.y + yOffset}, ${color});`);
                                    lines.push(`        }`);
                                }
                            }

                            // X-Grid (Vertical lines)
                            if (xGrid) {
                                // Drawing 4 vertical grid lines as a default if enabled
                                const xSteps = 4;
                                for (let i = 1; i < xSteps; i++) {
                                    const xOffset = Math.round(w.width * (i / xSteps));
                                    lines.push(`        for (int i = 0; i < ${w.height}; i += 4) {`);
                                    lines.push(`          it.draw_pixel_at(${w.x + xOffset}, ${w.y} + i, ${color});`);
                                    lines.push(`        }`);
                                }
                            }
                            if (title) {
                                lines.push(`        it.printf(${w.x}+4, ${w.y}+2, id(font_roboto_400_12), ${color}, TextAlign::TOP_LEFT, "${title}");`);
                            }
                            const minVal = parseFloat(minValue) || 0;
                            const maxVal = parseFloat(maxValue) || 100;
                            const yRange = maxVal - minVal;
                            const ySteps = 4;
                            for (let i = 0; i <= ySteps; i++) {
                                const val = minVal + (yRange * (i / ySteps));
                                const yOffset = Math.round(w.height * (1 - (i / ySteps)));
                                const fmt = yRange >= 10 ? "%.0f" : "%.1f";
                                lines.push(`        it.printf(${w.x} - 4, ${w.y} + ${yOffset} - 6, id(font_roboto_400_12), ${color}, TextAlign::TOP_RIGHT, "${fmt}", (float)${val});`);
                            }
                            let durationSec = 3600;
                            const durMatch = duration.match(/^(\d+)([a-z]+)$/i);
                            if (durMatch) {
                                const v = parseInt(durMatch[1], 10);
                                const u = durMatch[2].toLowerCase();
                                if (u.startsWith("s")) durationSec = v;
                                else if (u.startsWith("m")) durationSec = v * 60;
                                else if (u.startsWith("h")) durationSec = v * 3600;
                                else if (u.startsWith("d")) durationSec = v * 86400;
                            }
                            const xSteps = 2;
                            for (let i = 0; i <= xSteps; i++) {
                                const ratio = i / xSteps;
                                const xOffset = Math.round(w.width * ratio);
                                let align = "TextAlign::TOP_CENTER";
                                if (i === 0) align = "TextAlign::TOP_LEFT";
                                if (i === xSteps) align = "TextAlign::TOP_RIGHT";
                                let labelText = "";
                                if (i === xSteps) labelText = "Now";
                                else {
                                    const timeAgo = durationSec * (1 - ratio);
                                    if (timeAgo >= 3600) labelText = `-${(timeAgo / 3600).toFixed(1)}h`;
                                    else if (timeAgo >= 60) labelText = `-${(timeAgo / 60).toFixed(0)}m`;
                                    else labelText = `-${timeAgo.toFixed(0)}s`;
                                }
                                lines.push(`        it.printf(${w.x} + ${xOffset}, ${w.y} + ${w.height} + 2, id(font_roboto_400_12), ${color}, ${align}, "${labelText}");`);
                            }
                        } else {
                            lines.push(`        it.rectangle(${w.x}, ${w.y}, ${w.width}, ${w.height}, ${color});`);
                            lines.push(`        it.printf(${w.x}+5, ${w.y}+5, id(font_roboto_400_12), ${color}, TextAlign::TOP_LEFT, "Graph (no entity)");`);
                        }
                    } else if (t === "progress_bar") {
                        const entityId = (w.entity_id || "").trim();
                        const title = (w.title || "").replace(/"/g, '\\"');
                        const showLabel = p.show_label !== false;
                        const showPercentage = p.show_percentage !== false;
                        const barHeight = parseInt(p.bar_height || 15, 10);
                        const borderWidth = parseInt(p.border_width || 1, 10);
                        const colorProp = p.color || "black";
                        const color = getColorConst(colorProp);
                        usedFontIds.add("font_roboto_400_12"); // Progress bar uses small font for labels

                        lines.push(`        // widget:progress_bar id:${w.id} type:progress_bar x:${w.x} y:${w.y} w:${w.width} h:${w.height} entity:${entityId} title:"${title}" show_label:${showLabel} show_pct:${showPercentage} bar_height:${barHeight} border:${borderWidth} color:${colorProp} local:${!!p.is_local_sensor} ${getCondProps(w)}`);

                        if (entityId) {
                            const safeId = entityId.replace(/^sensor\./, "").replace(/\./g, "_").replace(/-/g, "_");
                            lines.push(`        float val_${w.id} = id(${safeId}).state;`);
                            lines.push(`        if (std::isnan(val_${w.id})) val_${w.id} = 0;`);
                            lines.push(`        int pct_${w.id} = (int)val_${w.id};`);
                            lines.push(`        if (pct_${w.id} < 0) pct_${w.id} = 0;`);
                            lines.push(`        if (pct_${w.id} > 100) pct_${w.id} = 100;`);
                            if (showLabel && title) {
                                lines.push(`        it.printf(${w.x}, ${w.y}, id(font_roboto_400_12), ${color}, TextAlign::TOP_LEFT, "${title}");`);
                            }
                            if (showPercentage) {
                                lines.push(`        it.printf(${w.x} + ${w.width}, ${w.y}, id(font_roboto_400_12), ${color}, TextAlign::TOP_RIGHT, "%d%%", pct_${w.id});`);
                            }
                            const barY = w.y + (w.height - barHeight);
                            lines.push(`        it.rectangle(${w.x}, ${barY}, ${w.width}, ${barHeight}, ${color});`);
                            lines.push(`        if (pct_${w.id} > 0) {`);
                            lines.push(`          int bar_w = (${w.width} - 4) * pct_${w.id} / 100;`);
                            lines.push(`          it.filled_rectangle(${w.x} + 2, ${barY} + 2, bar_w, ${barHeight} - 4, ${color});`);
                            lines.push(`        }`);
                        } else {
                            lines.push(`        it.rectangle(${w.x}, ${w.y} + ${w.height} - ${barHeight}, ${w.width}, ${barHeight}, ${color});`);
                            lines.push(`        it.filled_rectangle(${w.x} + 2, ${w.y} + ${w.height} - ${barHeight} + 2, ${w.width} / 2, ${barHeight} - 4, ${color});`);
                            if (showLabel && title) {
                                lines.push(`        it.printf(${w.x}, ${w.y}, id(font_roboto_400_12), ${color}, TextAlign::TOP_LEFT, "${title}");`);
                            }
                        }
                    } else if (t === "icon") {
                        const code = (p.code || "F0595").replace(/^0x/i, "");
                        const size = parseInt(p.size || 48, 10);
                        const colorProp = p.color || "black";
                        const color = getColorConst(colorProp);
                        const fontRef = `font_mdi_${size}`;
                        lines.push(`        // widget:icon id:${w.id} type:icon x:${w.x} y:${w.y} w:${w.width} h:${w.height} code:${code} size:${size} color:${colorProp} ${getCondProps(w)}`);
                        lines.push(`        it.print(${w.x}, ${w.y}, id(${fontRef}), ${color}, "\\U000${code}");`);
                    } else if (t === "battery_icon") {
                        const entityId = (w.entity_id || "").trim();
                        const size = parseInt(p.size || 24, 10);
                        const fontSize = parseInt(p.font_size || 12, 10);
                        const colorProp = p.color || "black";
                        const color = getColorConst(colorProp);
                        const fontRef = `font_mdi_${size}`;
                        const pctFontRef = `font_roboto_400_${fontSize}`;
                        usedFontIds.add(pctFontRef);

                        const sensorId = entityId ? entityId.replace(/^sensor\./, "").replace(/\./g, "_").replace(/-/g, "_") : "battery_level";

                        lines.push(`        // widget:battery_icon id:${w.id} type:battery_icon x:${w.x} y:${w.y} w:${w.width} h:${w.height} entity:${entityId || "battery_level"} size:${size} font_size:${fontSize} color:${colorProp} local:${!!p.is_local_sensor} ${getCondProps(w)}`);
                        lines.push(`        {`);
                        lines.push(`          const char* bat_icon = "\\U000F0082"; // Default: battery-outline (unknown)`);
                        lines.push(`          float bat_level = 0;`);
                        lines.push(`          if (id(${sensorId}).has_state()) {`);
                        lines.push(`            bat_level = id(${sensorId}).state;`);
                        lines.push(`            if (std::isnan(bat_level)) bat_level = 0;`);
                        lines.push(`            if (bat_level >= 95) bat_icon = "\\U000F0079";      // battery (full)`);
                        lines.push(`            else if (bat_level >= 85) bat_icon = "\\U000F0082"; // battery-90`);
                        lines.push(`            else if (bat_level >= 75) bat_icon = "\\U000F0081"; // battery-80`);
                        lines.push(`            else if (bat_level >= 65) bat_icon = "\\U000F0080"; // battery-70`);
                        lines.push(`            else if (bat_level >= 55) bat_icon = "\\U000F007F"; // battery-60`);
                        lines.push(`            else if (bat_level >= 45) bat_icon = "\\U000F007E"; // battery-50`);
                        lines.push(`            else if (bat_level >= 35) bat_icon = "\\U000F007D"; // battery-40`);
                        lines.push(`            else if (bat_level >= 25) bat_icon = "\\U000F007C"; // battery-30`);
                        lines.push(`            else if (bat_level >= 15) bat_icon = "\\U000F007B"; // battery-20`);
                        lines.push(`            else if (bat_level >= 5) bat_icon = "\\U000F007A";  // battery-10`);
                        lines.push(`            else bat_icon = "\\U000F0083";                      // battery-alert (critical)`);
                        lines.push(`          }`);
                        lines.push(`          it.printf(${w.x}, ${w.y}, id(${fontRef}), ${color}, "%s", bat_icon);`);
                        lines.push(`          it.printf(${w.x} + ${size}/2, ${w.y} + ${size} + 2, id(${pctFontRef}), ${color}, TextAlign::TOP_CENTER, "%.0f%%", bat_level);`);
                        lines.push(`        }`);
                    } else if (t === "weather_icon") {
                        const entityId = (w.entity_id || "").trim();
                        const size = parseInt(p.size || 48, 10);
                        const colorProp = p.color || "black";
                        const color = getColorConst(colorProp);
                        const fontRef = `font_mdi_${size}`;
                        lines.push(`        // widget:weather_icon id:${w.id} type:weather_icon x:${w.x} y:${w.y} w:${w.width} h:${w.height} entity:${entityId} size:${size} color:${colorProp} ${getCondProps(w)}`);
                        if (entityId) {
                            const safeId = entityId.replace(/^sensor\./, "").replace(/\./g, "_").replace(/-/g, "_");
                            // Generate dynamic weather icon mapping based on entity state
                            lines.push(`        {`);
                            lines.push(`          std::string weather_state = id(${safeId}).state;`);
                            lines.push(`          const char* icon = "\\U000F0599"; // Default: sunny`);
                            lines.push(`          if (weather_state == "clear-night") icon = "\\U000F0594";`);
                            lines.push(`          else if (weather_state == "cloudy") icon = "\\U000F0590";`);
                            lines.push(`          else if (weather_state == "exceptional") icon = "\\U000F0026";`);
                            lines.push(`          else if (weather_state == "fog") icon = "\\U000F0591";`);
                            lines.push(`          else if (weather_state == "hail") icon = "\\U000F0592";`);
                            lines.push(`          else if (weather_state == "lightning") icon = "\\U000F0593";`);
                            lines.push(`          else if (weather_state == "lightning-rainy") icon = "\\U000F067E";`);
                            lines.push(`          else if (weather_state == "partlycloudy") icon = "\\U000F0595";`);
                            lines.push(`          else if (weather_state == "pouring") icon = "\\U000F0596";`);
                            lines.push(`          else if (weather_state == "rainy") icon = "\\U000F0597";`);
                            lines.push(`          else if (weather_state == "snowy") icon = "\\U000F0598";`);
                            lines.push(`          else if (weather_state == "snowy-rainy") icon = "\\U000F067F";`);
                            lines.push(`          else if (weather_state == "sunny") icon = "\\U000F0599";`);
                            lines.push(`          else if (weather_state == "windy") icon = "\\U000F059D";`);
                            lines.push(`          else if (weather_state == "windy-variant") icon = "\\U000F059E";`);
                            lines.push(`          it.printf(${w.x}, ${w.y}, id(${fontRef}), ${color}, "%s", icon);`);
                            lines.push(`        }`);
                        } else {
                            lines.push(`        it.printf(${w.x}, ${w.y}, id(${fontRef}), ${color}, "\\U000F0595");`);
                        }
                    } else if (t === "qr_code") {
                        const value = (p.value || "https://esphome.io").replace(/"/g, '\\"');
                        const ecc = p.ecc || "LOW";
                        const colorProp = p.color || "black";
                        const color = getColorConst(colorProp);
                        const safeId = `qr_${w.id}`.replace(/-/g, "_");

                        // Auto-calculate scale based on widget size
                        // QR code module count varies by content length and ECC level
                        // Typical range: 21 (version 1) to 177 (version 40)
                        // For a simple URL, usually around 25-33 modules
                        // Use the smaller dimension to ensure it fits
                        const availableSize = Math.min(w.width, w.height);
                        // Estimate module count (21 base + ~4 per 20 chars for low ECC)
                        const contentLen = (p.value || "https://esphome.io").length;
                        const estimatedModules = Math.min(177, 21 + Math.ceil(contentLen / 10) * 2);
                        const scale = Math.max(1, Math.floor(availableSize / estimatedModules));

                        lines.push(`        // widget:qr_code id:${w.id} type:qr_code x:${w.x} y:${w.y} w:${w.width} h:${w.height} value:"${value}" scale:${scale} ecc:${ecc} color:${colorProp} ${getCondProps(w)}`);
                        lines.push(`        it.qr_code(${w.x}, ${w.y}, id(${safeId}), ${color}, ${scale});`);
                    } else if (t === "quote_rss") {
                        // Quote/RSS widget - display quote text with optional author
                        const feedUrl = p.feed_url || "https://www.brainyquote.com/link/quotebr.rss";
                        const showAuthor = p.show_author !== false;
                        const quoteFontSize = parseInt(p.quote_font_size || 18, 10);
                        const authorFontSize = parseInt(p.author_font_size || 14, 10);
                        const fontFamily = p.font_family || "Roboto";
                        const fontWeight = parseInt(p.font_weight || 400, 10);
                        const colorProp = p.color || "black";
                        const color = getColorConst(colorProp);
                        const textAlign = p.text_align || "TOP_LEFT";
                        const wordWrap = p.word_wrap !== false;
                        const italicQuote = p.italic_quote !== false;
                        const refreshInterval = p.refresh_interval || "1h";
                        const randomQuote = p.random !== false;
                        const autoScale = p.auto_scale || false;

                        // Font sizes for auto-scale (100%, 75%, 50%)
                        const size1 = quoteFontSize;
                        const size2 = Math.max(8, Math.floor(size1 * 0.75));
                        const size3 = Math.max(8, Math.floor(size1 * 0.50));

                        // Register fonts
                        addFont(fontFamily, fontWeight, size1, italicQuote);
                        if (autoScale) {
                            addFont(fontFamily, fontWeight, size2, italicQuote);
                            addFont(fontFamily, fontWeight, size3, italicQuote);
                        }
                        if (showAuthor) {
                            addFont(fontFamily, fontWeight, authorFontSize, false);
                        }

                        // Generate font IDs
                        const safeFamily = fontFamily.replace(/\s+/g, "_").toLowerCase();
                        const quoteItalicSuffix = italicQuote ? "_italic" : "";
                        const getQId = (s) => `font_${safeFamily}_${fontWeight}_${s}${quoteItalicSuffix}`;
                        const quoteFontId1 = getQId(size1);
                        const quoteFontId2 = getQId(size2);
                        const quoteFontId3 = getQId(size3);
                        const authorFontId = `font_${safeFamily}_${fontWeight}_${authorFontSize}`;

                        // Sensor IDs
                        const quoteTextId = `quote_text_${w.id}`.replace(/-/g, "_");
                        const quoteAuthorId = `quote_author_${w.id}`.replace(/-/g, "_");
                        const alignX = getAlignX(textAlign, w.x, w.width);
                        const alignY = getAlignY(textAlign, w.y, w.height);
                        const espAlign = `TextAlign::${textAlign}`;

                        lines.push(`        // widget:quote_rss id:${w.id} type:quote_rss x:${w.x} y:${w.y} w:${w.width} h:${w.height} feed_url:"${feedUrl}" show_author:${showAuthor} quote_font_size:${quoteFontSize} author_font_size:${authorFontSize} font_family:"${fontFamily}" weight:${fontWeight} color:${colorProp} align:${textAlign} word_wrap:${wordWrap} italic_quote:${italicQuote} refresh_interval:${refreshInterval} random:${randomQuote} auto_scale:${autoScale} ${getCondProps(w)}`);
                        lines.push(`        {`);
                        lines.push(`          std::string quote_text = id(${quoteTextId}_global);`);
                        if (showAuthor) {
                            lines.push(`          std::string quote_author = id(${quoteAuthorId}_global);`);
                        }
                        lines.push(``);

                        if (wordWrap) {
                            const maxWidth = w.width - 16;
                            lines.push(`          int max_width = ${maxWidth};`);
                            lines.push(`          int y_start = ${w.y + 8};`);
                            lines.push(`          int x_pos = ${w.x + 8};`);
                            lines.push(`          int max_height = ${w.height - 16 - (showAuthor ? (authorFontSize + 8) : 0)};`);
                            lines.push(`          std::string display_text = "\\"" + quote_text + "\\"";`);

                            // Define C++ lambda for printing/measuring
                            lines.push(`          auto print_quote = [&](esphome::font::Font *font, int line_h, bool draw) -> int {`);
                            lines.push(`            int y_curr = y_start;`);
                            lines.push(`            std::string current_line = "";`);
                            lines.push(`            size_t pos = 0;`);
                            lines.push(`            size_t space_pos;`);
                            lines.push(`            while ((space_pos = display_text.find(' ', pos)) != std::string::npos) {`);
                            lines.push(`                std::string word = display_text.substr(pos, space_pos - pos);`);
                            lines.push(`                std::string test_line = current_line.empty() ? word : current_line + " " + word;`);
                            lines.push(`                int w, h, xoff, bl;`);
                            lines.push(`                font->measure(test_line.c_str(), &w, &xoff, &bl, &h);`);
                            lines.push(`                if (w > max_width && !current_line.empty()) {`);
                            lines.push(`                    if (draw) it.printf(x_pos, y_curr, font, ${color}, "%s", current_line.c_str());`);
                            lines.push(`                    y_curr += line_h;`);
                            lines.push(`                    current_line = word;`);
                            lines.push(`                } else {`);
                            lines.push(`                    current_line = test_line;`);
                            lines.push(`                }`);
                            lines.push(`                pos = space_pos + 1;`);
                            lines.push(`            }`);
                            lines.push(`            if (!current_line.empty()) {`);
                            lines.push(`                std::string rem = display_text.substr(pos);`);
                            lines.push(`                if (!current_line.empty()) current_line += " ";`);
                            lines.push(`                current_line += rem;`);
                            lines.push(`            }`);
                            lines.push(`            if (!current_line.empty()) {`);
                            lines.push(`                if (draw) it.printf(x_pos, y_curr, font, ${color}, "%s", current_line.c_str());`);
                            lines.push(`                y_curr += line_h;`);
                            lines.push(`            }`);
                            lines.push(`            return y_curr - y_start;`);
                            lines.push(`          };`);

                            // Selection logic
                            lines.push(``);
                            if (autoScale) {
                                lines.push(`          // Auto-scale logic`);
                                lines.push(`          esphome::font::Font *selected_font = id(${quoteFontId1});`);
                                lines.push(`          int lh = ${Math.ceil(size1 * 1.3)};`);
                                lines.push(`          if (print_quote(selected_font, lh, false) > max_height) {`);
                                lines.push(`              selected_font = id(${quoteFontId2});`);
                                lines.push(`              lh = ${Math.ceil(size2 * 1.3)};`);
                                lines.push(`              if (print_quote(selected_font, lh, false) > max_height) {`);
                                lines.push(`                  selected_font = id(${quoteFontId3});`);
                                lines.push(`                  lh = ${Math.ceil(size3 * 1.3)};`);
                                lines.push(`              }`);
                                lines.push(`          }`);
                                lines.push(`          int final_h = print_quote(selected_font, lh, true);`);
                            } else {
                                lines.push(`          int final_h = print_quote(id(${quoteFontId1}), ${Math.ceil(size1 * 1.3)}, true);`);
                            }

                            if (showAuthor) {
                                lines.push(``);
                                lines.push(`          // Draw author below quote`);
                                lines.push(`          if (!quote_author.empty()) {`);
                                lines.push(`            int author_y = y_start + final_h + 4;`);
                                lines.push(`            it.printf(x_pos, author_y, id(${authorFontId}), ${color}, "— %s", quote_author.c_str());`);
                                lines.push(`          }`);
                            }

                        } else {
                            // No word wrap - simple single line
                            lines.push(`          it.printf(${alignX}, ${alignY}, id(${quoteFontId1}), ${color}, ${espAlign}, "\\"%s\\"", quote_text.c_str());`);
                            if (showAuthor) {
                                lines.push(`          if (!quote_author.empty()) {`);
                                lines.push(`            it.printf(${alignX}, ${alignY + quoteFontSize + 4}, id(${authorFontId}), ${color}, ${espAlign}, "— %s", quote_author.c_str());`);
                                lines.push(`          }`);
                            }
                        }
                        lines.push(`        }`);
                    } else if (t === "weather_forecast") {
                        // Weather Forecast widget - displays 5-day forecast with icons and temps
                        const weatherEntity = w.entity_id || p.weather_entity || "weather.forecast_home";
                        const layout = p.layout || "horizontal";
                        const showHighLow = p.show_high_low !== false;
                        const dayFontSize = parseInt(p.day_font_size || 14, 10);
                        const tempFontSize = parseInt(p.temp_font_size || 14, 10);
                        const iconSize = parseInt(p.icon_size || 32, 10);
                        const fontFamily = p.font_family || "Roboto";
                        const colorProp = p.color || "black";
                        const color = getColorConst(colorProp);

                        // Font IDs
                        const safeFontFamily = fontFamily.replace(/\s+/g, "_").toLowerCase();
                        const dayFontId = `font_${safeFontFamily}_700_${dayFontSize}`;
                        const tempFontId = `font_${safeFontFamily}_400_${tempFontSize}`;
                        const iconFontId = `font_mdi_${iconSize}`;

                        lines.push(`        // widget:weather_forecast id:${w.id} type:weather_forecast x:${w.x} y:${w.y} w:${w.width} h:${w.height} weather_entity:"${weatherEntity}" layout:${layout} show_high_low:${showHighLow} day_font_size:${dayFontSize} temp_font_size:${tempFontSize} icon_size:${iconSize} font_family:"${fontFamily}" color:${colorProp} ${getCondProps(w)}`);
                        lines.push(`        {`);
                        lines.push(`          // Weather condition to MDI icon mapping`);
                        lines.push(`          static std::map<std::string, const char*> weather_icons = {`);
                        lines.push(`            {"clear-night", "\\U000F0594"}, {"cloudy", "\\U000F0590"},`);
                        lines.push(`            {"exceptional", "\\U000F0026"}, {"fog", "\\U000F0591"},`);
                        lines.push(`            {"hail", "\\U000F0592"}, {"lightning", "\\U000F0593"},`);
                        lines.push(`            {"lightning-rainy", "\\U000F067E"}, {"partlycloudy", "\\U000F0595"},`);
                        lines.push(`            {"pouring", "\\U000F0596"}, {"rainy", "\\U000F0597"},`);
                        lines.push(`            {"snowy", "\\U000F0598"}, {"snowy-rainy", "\\U000F067F"},`);
                        lines.push(`            {"sunny", "\\U000F0599"}, {"windy", "\\U000F059D"},`);
                        lines.push(`            {"windy-variant", "\\U000F059E"}`);
                        lines.push(`          };`);
                        lines.push(``);
                        lines.push(`          auto get_icon = [&](const std::string& cond) -> const char* {`);
                        lines.push(`            return weather_icons.count(cond) ? weather_icons[cond] : "\\U000F0590";`);
                        lines.push(`          };`);
                        lines.push(``);
                        lines.push(`          auto get_day_name = [](int offset) -> std::string {`);
                        lines.push(`            if (offset == 0) return "Today";`);
                        lines.push(`            auto t = id(ha_time).now();`);
                        lines.push(`            if (!t.is_valid()) return "---";`);
                        lines.push(`            ESPTime future = ESPTime::from_epoch_local(t.timestamp + (offset * 86400));`);
                        lines.push(`            char buf[8]; future.strftime(buf, sizeof(buf), "%a");`);
                        lines.push(`            return std::string(buf);`);
                        lines.push(`          };`);
                        lines.push(``);

                        // Calculate layout increments and center offset
                        const isHorizontal = layout === "horizontal";
                        const xInc = isHorizontal ? Math.floor(w.width / 5) : 0;
                        const yInc = isHorizontal ? 0 : Math.floor(w.height / 5);
                        const centerOffset = isHorizontal ? Math.floor(xInc / 2) : Math.floor(w.width / 2);

                        lines.push(`          int x_inc = ${xInc};`);
                        lines.push(`          int y_inc = ${yInc};`);
                        lines.push(`          int center_offset = ${centerOffset};`);
                        lines.push(``);

                        // Generate rendering for each day (0-4)
                        for (let day = 0; day < 5; day++) {
                            const safeEntityBase = weatherEntity.replace(/\./g, "_").replace(/-/g, "_");
                            const condSensorId = `weather_cond_day${day}`;
                            const highSensorId = `weather_high_day${day}`;
                            const lowSensorId = `weather_low_day${day}`;

                            // Calculate absolute positions for this day at generation time
                            const dayX = w.x + day * xInc;
                            const dayY = w.y + day * yInc;
                            const centerX = dayX + centerOffset;

                            lines.push(`          // Day ${day}`);
                            lines.push(`          {`);
                            lines.push(`            int dx = ${dayX};`);
                            lines.push(`            int dy = ${dayY};`);
                            lines.push(``);
                            lines.push(`            // Day name (centered)`);
                            lines.push(`            it.printf(dx + center_offset, dy, id(${dayFontId}), ${color}, TextAlign::TOP_CENTER, "%s", get_day_name(${day}).c_str());`);
                            lines.push(``);
                            lines.push(`            // Weather icon (centered)`);
                            lines.push(`            std::string cond = id(${condSensorId}).state;`);
                            lines.push(`            it.printf(dx + center_offset, dy + ${dayFontSize + 4}, id(${iconFontId}), ${color}, TextAlign::TOP_CENTER, "%s", get_icon(cond));`);

                            if (showHighLow) {
                                lines.push(``);
                                lines.push(`            // High/Low temps (centered)`);
                                lines.push(`            float high = id(${highSensorId}).state;`);
                                lines.push(`            float low = id(${lowSensorId}).state;`);
                                lines.push(`            if (!std::isnan(high) && !std::isnan(low)) {`);
                                lines.push(`              it.printf(dx + center_offset, dy + ${dayFontSize + iconSize + 8}, id(${tempFontId}), ${color}, TextAlign::TOP_CENTER, "%.0f/%.0f", high, low);`);
                                lines.push(`            }`);
                            }
                            lines.push(`          }`);
                        }
                        lines.push(`        }`);
                    } else if (t === "rounded_rect") {
                        const fill = !!p.fill;
                        // Default show_border to true if not explicitly false
                        const showBorder = p.show_border !== false;
                        const r = parseInt(p.radius || 10, 10);
                        const thickness = parseInt(p.border_width || 4, 10);
                        const colorProp = p.color || "black";
                        const color = getColorConst(colorProp);
                        const isGray = colorProp.toLowerCase() === "gray";

                        // Limit radius to half geometric size
                        lines.push(`        // widget:rounded_rect id:${w.id} type:rounded_rect x:${w.x} y:${w.y} w:${w.width} h:${w.height} fill:${fill} show_border:${showBorder} border:${thickness} radius:${r} color:${colorProp} ${getCondProps(w)}`);
                        lines.push(`        {`);
                        lines.push(`          int r = ${r};`);
                        lines.push(`          int w = ${w.width};`);
                        lines.push(`          int h = ${w.height};`);
                        lines.push(`          if (r > w/2) r = w/2;`);
                        lines.push(`          if (r > h/2) r = h/2;`);
                        lines.push(``);
                        lines.push(`          auto draw_rrect = [&](int x, int y, int w, int h, int r, auto c) {`);
                        lines.push(`            // Center vertical strip`);
                        lines.push(`            it.filled_rectangle(x + r, y, w - 2 * r, h, c);`);
                        lines.push(`            // Left side (between corners)`);
                        lines.push(`            it.filled_rectangle(x, y + r, r, h - 2 * r, c);`);
                        lines.push(`            // Right side (between corners)`);
                        lines.push(`            it.filled_rectangle(x + w - r, y + r, r, h - 2 * r, c);`);
                        lines.push(`            // Corners`);
                        lines.push(`            it.filled_circle(x + r, y + r, r, c);`);
                        lines.push(`            it.filled_circle(x + w - r, y + r, r, c);`);
                        lines.push(`            it.filled_circle(x + r, y + h - r, r, c);`);
                        lines.push(`            it.filled_circle(x + w - r, y + h - r, r, c);`);
                        lines.push(`          };`);
                        lines.push(``); // Blank line

                        if (fill) {
                            let fx = w.x, fy = w.y, fw = w.width, fh = w.height, fr = r;

                            if (showBorder) {
                                lines.push(`          // Draw Black Border (Outer)`);
                                lines.push(`          draw_rrect(${w.x}, ${w.y}, w, h, r, COLOR_ON);`);

                                // Shrink for fill
                                const t = thickness;
                                fx += t; fy += t; fw -= 2 * t; fh -= 2 * t; fr -= t;
                                if (fr < 0) fr = 0;

                                if (isGray && fw > 0 && fh > 0) {
                                    lines.push(`          // Clear inner for dithering`);
                                    lines.push(`          draw_rrect(${fx}, ${fy}, ${fw}, ${fh}, ${fr}, COLOR_OFF);`);
                                }
                            }

                            if (isGray) {
                                lines.push(`          // Gray fill using 50% checkerboard dithering`);
                                // Need to perform loop on adjusted coordinates
                                // If showBorder, the indices change.
                                // C++ Code generation:
                                lines.push(`          int fx = ${fx}; int fy = ${fy}; int fw = ${fw}; int fh = ${fh}; int fr = ${fr};`); // Use interpolated JS values
                                lines.push(`          if (fw > 0 && fh > 0) {`);
                                lines.push(`            for (int dy = 0; dy < fh; dy++) {`);
                                lines.push(`              for (int dx = 0; dx < fw; dx++) {`);
                                lines.push(`                if ((fx + dx + fy + dy) % 2 != 0) continue;`); // Global dithering alignment
                                lines.push(`                bool inside = false;`);
                                lines.push(`                if ((dx >= fr && dx < fw - fr) || (dy >= fr && dy < fh - fr)) {`);
                                lines.push(`                  inside = true;`);
                                lines.push(`                } else {`);
                                lines.push(`                  int cx = (dx < fr) ? fr : fw - fr;`);
                                lines.push(`                  int cy = (dy < fr) ? fr : fh - fr;`);
                                lines.push(`                  if ((dx - cx)*(dx - cx) + (dy - cy)*(dy - cy) < fr*fr) inside = true;`);
                                lines.push(`                }`);
                                lines.push(`                if (inside) it.draw_pixel_at(fx + dx, fy + dy, COLOR_ON);`);
                                lines.push(`              }`);
                                lines.push(`            }`);
                                lines.push(`          }`);
                            } else {
                                // Solid Color Fill
                                lines.push(`          // Fill Inner`);
                                if (showBorder) {
                                    // Use interpolated values
                                    lines.push(`          if (${fw} > 0 && ${fh} > 0) draw_rrect(${fx}, ${fy}, ${fw}, ${fh}, ${fr}, ${color});`);
                                } else {
                                    // No border, just draw full
                                    lines.push(`          draw_rrect(${w.x}, ${w.y}, w, h, r, ${color});`);
                                }
                            }
                        } else {
                            // Outline Mode
                            lines.push(`          // Draw Outer`);
                            lines.push(`          draw_rrect(${w.x}, ${w.y}, w, h, r, ${color});`);
                            lines.push(`          // Erase center to create outline`);
                            lines.push(`          int t = ${thickness};`);
                            lines.push(`          int ir = r - t; if (ir < 0) ir = 0;`);
                            lines.push(`          draw_rrect(${w.x} + t, ${w.y} + t, w - 2*t, h - 2*t, ir, COLOR_OFF);`);
                        }

                        lines.push(`        }`);

                    } else if (t === "shape_rect") {
                        const fill = !!p.fill;
                        const borderWidth = parseInt(p.border_width || 1, 10);
                        const colorProp = p.color || "black";
                        const color = getColorConst(colorProp);
                        const opacity = parseInt(p.opacity || 100, 10);
                        const isGray = colorProp.toLowerCase() === "gray";
                        const rectY = w.y + RECT_Y_OFFSET;
                        lines.push(`        // widget:shape_rect id:${w.id} type:shape_rect x:${w.x} y:${w.y} w:${w.width} h:${w.height} fill:${fill} border:${borderWidth} opacity:${opacity} color:${colorProp} ${getCondProps(w)}`);
                        if (fill) {
                            if (isGray) {
                                // Gray: use 50% checkerboard dithering pattern
                                lines.push(`        // Gray fill using 50% checkerboard dithering pattern`);
                                lines.push(`        for (int dy = 0; dy < ${w.height}; dy++) {`);
                                lines.push(`          for (int dx = 0; dx < ${w.width}; dx++) {`);
                                lines.push(`            if ((dx + dy) % 2 == 0) {`);
                                lines.push(`              it.draw_pixel_at(${w.x}+dx, ${rectY}+dy, COLOR_ON);`);
                                lines.push(`            }`);
                                lines.push(`          }`);
                                lines.push(`        }`);
                            } else {
                                lines.push(`        it.filled_rectangle(${w.x}, ${rectY}, ${w.width}, ${w.height}, ${color});`);
                            }
                        } else {
                            if (borderWidth <= 1) {
                                lines.push(`        it.rectangle(${w.x}, ${rectY}, ${w.width}, ${w.height}, ${color});`);
                            } else {
                                lines.push(`        for (int i=0; i<${borderWidth}; i++) {`);
                                lines.push(`          it.rectangle(${w.x}+i, ${rectY}+i, ${w.width}-2*i, ${w.height}-2*i, ${color});`);
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
                        const color = getColorConst(colorProp);
                        const opacity = parseInt(p.opacity || 100, 10);
                        const isGray = colorProp.toLowerCase() === "gray";
                        lines.push(`        // widget:shape_circle id:${w.id} type:shape_circle x:${w.x} y:${w.y} w:${w.width} h:${w.height} fill:${fill} border:${borderWidth} opacity:${opacity} color:${colorProp} ${getCondProps(w)}`);
                        if (fill) {
                            if (isGray) {
                                // Gray: use 50% checkerboard dithering pattern for circle
                                lines.push(`        // Gray circle fill using 50% checkerboard dithering pattern`);
                                lines.push(`        for (int dy = -${Math.floor(r)}; dy <= ${Math.floor(r)}; dy++) {`);
                                lines.push(`          for (int dx = -${Math.floor(r)}; dx <= ${Math.floor(r)}; dx++) {`);
                                lines.push(`            if (dx*dx + dy*dy <= ${Math.floor(r)}*${Math.floor(r)}) {`);
                                lines.push(`              if ((dx + dy) % 2 == 0) {`);
                                lines.push(`                it.draw_pixel_at(${Math.floor(cx)}+dx, ${Math.floor(cy)}+dy, COLOR_ON);`);
                                lines.push(`              }`);
                                lines.push(`            }`);
                                lines.push(`          }`);
                                lines.push(`        }`);
                            } else {
                                lines.push(`        it.filled_circle(${cx}, ${cy}, ${r}, ${color});`);
                            }
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
                        const color = getColorConst(colorProp);
                        const fontFamily = p.font_family || "Roboto";
                        const italic = p.italic ? "true" : "false";
                        const italicSuffix = p.italic ? "_italic" : "";
                        const timeFontId = `font_${fontFamily.toLowerCase().replace(/\s+/g, '_')}_700_${timeSize}${italicSuffix}`;
                        const dateFontId = `font_${fontFamily.toLowerCase().replace(/\s+/g, '_')}_400_${dateSize}${italicSuffix}`;
                        usedFontIds.add(timeFontId);
                        usedFontIds.add(dateFontId);
                        lines.push(`        // widget:datetime id:${w.id} type:datetime x:${w.x} y:${w.y} w:${w.width} h:${w.height} format:${format} time_font:${timeSize} date_font:${dateSize} color:${colorProp} font_family:"${fontFamily}" italic:${italic} ${getCondProps(w)}`);
                        lines.push(`        auto now = id(ha_time).now();`);
                        const cx = w.x + Math.floor(w.width / 2);
                        if (format === "time_only") {
                            lines.push(`        it.strftime(${cx}, ${w.y} + ${TEXT_Y_OFFSET}, id(${timeFontId}), ${color}, TextAlign::TOP_CENTER, "%H:%M", now);`);
                        } else if (format === "date_only") {
                            lines.push(`        it.strftime(${cx}, ${w.y} + ${TEXT_Y_OFFSET}, id(${dateFontId}), ${color}, TextAlign::TOP_CENTER, "%a, %b %d", now);`);
                        } else {
                            lines.push(`        it.strftime(${cx}, ${w.y} + ${TEXT_Y_OFFSET}, id(${timeFontId}), ${color}, TextAlign::TOP_CENTER, "%H:%M", now);`);
                            lines.push(`        it.strftime(${cx}, ${w.y} + ${timeSize} + 4 + ${TEXT_Y_OFFSET}, id(${dateFontId}), ${color}, TextAlign::TOP_CENTER, "%a, %b %d", now);`);
                        }
                    } else if (t === "image") {
                        const path = (p.path || "").trim();
                        const invert = !!p.invert;
                        const renderMode = p.render_mode || "Auto";
                        lines.push(`        // widget:image id:${w.id} type:image x:${w.x} y:${w.y} w:${w.width} h:${w.height} path:"${path}" invert:${invert} render_mode:"${renderMode}" ${getCondProps(w)}`);
                        if (path) {
                            // Generate same ID format as in the image: section
                            const safePath = path.replace(/[^a-zA-Z0-9]/g, "_").replace(/^_+|_+$/g, "").replace(/_+/g, "_");
                            const safeId = `img_${safePath}_${w.width}x${w.height}`;
                            if (invert) {
                                lines.push(`        it.image(${w.x}, ${w.y}, id(${safeId}), COLOR_OFF, COLOR_ON);`);
                            } else {
                                lines.push(`        it.image(${w.x}, ${w.y}, id(${safeId}));`);
                            }
                        }
                    } else if (t === "online_image") {
                        const url = p.url || "";
                        const invert = !!p.invert;
                        const renderMode = p.render_mode || "Auto";
                        // Sanitize widget ID to match the online_image: component declaration
                        const onlineImageId = `online_image_${w.id}`.replace(/-/g, "_");
                        lines.push(`        // widget:online_image id:${w.id} type:online_image x:${w.x} y:${w.y} w:${w.width} h:${w.height} url:"${url}" invert:${invert} render_mode:"${renderMode}" ${getCondProps(w)}`);
                        if (invert) {
                            lines.push(`        it.image(${w.x}, ${w.y}, id(${onlineImageId}), COLOR_OFF, COLOR_ON);`);
                        } else {
                            lines.push(`        it.image(${w.x}, ${w.y}, id(${onlineImageId}));`);
                        }
                    } else if (t === "puppet") {
                        const url = p.image_url || "";
                        const invert = !!p.invert;
                        const renderMode = p.render_mode || "Auto";
                        lines.push(`        // widget:puppet id:${w.id} type:puppet x:${w.x} y:${w.y} w:${w.width} h:${w.height} url:"${url}" invert:${invert} render_mode:"${renderMode}" ${getCondProps(w)}`);
                        const puppetId = `puppet_${w.id}`.replace(/-/g, "_");
                        if (invert) {
                            lines.push(`        it.image(${w.x}, ${w.y}, id(${puppetId}), COLOR_OFF, COLOR_ON);`);
                        } else {
                            lines.push(`        it.image(${w.x}, ${w.y}, id(${puppetId}));`);
                        }
                    } else if (t === "quote_rss") {
                        // Quote/RSS widget - displays a quote from an RSS feed
                        const feedUrl = (p.feed_url || "https://www.brainyquote.com/link/quotebr.rss").replace(/"/g, '\\"');
                        const showAuthor = p.show_author !== false;
                        const quoteFontSize = parseInt(p.quote_font_size || 18, 10);
                        const authorFontSize = parseInt(p.author_font_size || 14, 10);
                        const fontFamily = p.font_family || "Roboto";
                        const fontWeight = parseInt(p.font_weight || 400, 10);
                        const colorProp = p.color || "black";
                        const color = getColorConst(colorProp);
                        const textAlign = p.text_align || "TOP_LEFT";
                        const italicQuote = p.italic_quote !== false;
                        const refreshInterval = p.refresh_interval || "1h";
                        const randomQuote = p.random !== false;
                        const wordWrap = p.word_wrap !== false;

                        // Generate unique IDs for this widget's sensors
                        const quoteTextId = `quote_text_${w.id}`.replace(/-/g, "_");
                        const quoteAuthorId = `quote_author_${w.id}`.replace(/-/g, "_");

                        // Add fonts - quote font may be italic, author font is not
                        const quoteItalicSuffix = italicQuote ? "_italic" : "";
                        const quoteFontId = `font_${fontFamily.toLowerCase().replace(/\s+/g, '_')}_${fontWeight}_${quoteFontSize}${quoteItalicSuffix}`;
                        const authorFontId = `font_${fontFamily.toLowerCase().replace(/\s+/g, '_')}_${fontWeight}_${authorFontSize}`;
                        addFont(fontFamily, fontWeight, quoteFontSize, italicQuote);
                        addFont(fontFamily, fontWeight, authorFontSize, false);
                        usedFontIds.add(quoteFontId);
                        if (showAuthor) usedFontIds.add(authorFontId);

                        lines.push(`        // widget:quote_rss id:${w.id} type:quote_rss x:${w.x} y:${w.y} w:${w.width} h:${w.height} feed_url:"${feedUrl}" show_author:${showAuthor} quote_font:${quoteFontSize} author_font:${authorFontSize} color:${colorProp} align:${textAlign} italic:${italicQuote} refresh:${refreshInterval} random:${randomQuote} wrap:${wordWrap} ${getCondProps(w)}`);

                        // Calculate alignment X position
                        const alignX = getAlignX(textAlign, w.x, w.width);
                        const esphomeAlign = `TextAlign::${textAlign}`;

                        // Generate the display code with word wrapping support
                        lines.push(`        {`);
                        lines.push(`          std::string quote_text = id(${quoteTextId}_global);`);
                        if (showAuthor) {
                            lines.push(`          std::string quote_author = id(${quoteAuthorId}_global);`);
                        }


                        if (wordWrap) {
                            // Word wrap implementation
                            lines.push(`          // Word wrap the quote text`);
                            lines.push(`          int max_width = ${w.width - 16};  // Leave padding`);
                            lines.push(`          int line_height = ${quoteFontSize + 4};`);
                            lines.push(`          int y_pos = ${w.y + 8};`);
                            lines.push(`          std::string current_line = "";`);
                            lines.push(`          std::string word = "";`);
                            lines.push(`          `);
                            lines.push(`          // Add opening quote mark`);
                            lines.push(`          quote_text = "\\"" + quote_text + "\\"";`);
                            lines.push(`          `);
                            lines.push(`          for (size_t i = 0; i <= quote_text.length(); i++) {`);
                            lines.push(`            char c = (i < quote_text.length()) ? quote_text[i] : ' ';`);
                            lines.push(`            if (c == ' ' || c == '\\0' || i == quote_text.length()) {`);
                            lines.push(`              if (!word.empty()) {`);
                            lines.push(`                std::string test_line = current_line.empty() ? word : current_line + " " + word;`);
                            lines.push(`                int test_width = 0, test_height = 0, x_offset = 0;`);
                            lines.push(`                id(${quoteFontId}).measure(test_line.c_str(), &test_width, &x_offset, &test_height, &test_height);`);
                            lines.push(`                if (test_width > max_width && !current_line.empty()) {`);
                            lines.push(`                  it.printf(${alignX}, y_pos, id(${quoteFontId}), ${color}, ${esphomeAlign}, "%s", current_line.c_str());`);
                            lines.push(`                  y_pos += line_height;`);
                            lines.push(`                  current_line = word;`);
                            lines.push(`                } else {`);
                            lines.push(`                  current_line = test_line;`);
                            lines.push(`                }`);
                            lines.push(`                word = "";`);
                            lines.push(`              }`);
                            lines.push(`            } else {`);
                            lines.push(`              word += c;`);
                            lines.push(`            }`);
                            lines.push(`          }`);
                            lines.push(`          if (!current_line.empty()) {`);
                            lines.push(`            it.printf(${alignX}, y_pos, id(${quoteFontId}), ${color}, ${esphomeAlign}, "%s", current_line.c_str());`);
                            lines.push(`            y_pos += line_height;`);
                            lines.push(`          }`);

                            if (showAuthor) {
                                lines.push(`          // Draw author`);
                                lines.push(`          if (!quote_author.empty()) {`);
                                lines.push(`            y_pos += 4;  // Extra spacing before author`);
                                lines.push(`            it.printf(${alignX}, y_pos, id(${authorFontId}), ${color}, ${esphomeAlign}, "— %s", quote_author.c_str());`);
                                lines.push(`          }`);
                            }
                        } else {
                            // Simple mode without word wrap (single line quote)
                            lines.push(`          it.printf(${alignX}, ${w.y + 8}, id(${quoteFontId}), ${color}, ${esphomeAlign}, "\\"%s\\"", quote_text.c_str());`);
                            if (showAuthor) {
                                lines.push(`          if (!quote_author.empty()) {`);
                                lines.push(`            it.printf(${alignX}, ${w.y + 8 + quoteFontSize + 4}, id(${authorFontId}), ${color}, ${esphomeAlign}, "— %s", quote_author.c_str());`);
                                lines.push(`          }`);
                            }
                        }

                        lines.push(`        }`);
                    } else if (t === "line") {
                        const colorProp = p.color || "black";
                        const color = getColorConst(colorProp);
                        const strokeWidth = parseInt(p.stroke_width || 3, 10) || 3;
                        const orientation = p.orientation || "horizontal";

                        // Use filled_rectangle for lines - simpler and supports thickness
                        // For horizontal: width is w.width (line length), height is strokeWidth
                        // For vertical: width is strokeWidth, height is w.height (line length)

                        let rectW, rectH;

                        if (orientation === "vertical") {
                            rectW = strokeWidth;
                            rectH = w.height;
                        } else {
                            rectW = w.width;
                            rectH = strokeWidth;
                        }

                        lines.push(`        // widget:line id:${w.id} type:line x:${w.x} y:${w.y} w:${rectW} h:${rectH} stroke:${strokeWidth} color:${colorProp} orientation:${orientation} ${getCondProps(w)}`);
                        lines.push(`        it.filled_rectangle(${w.x}, ${w.y}, ${rectW}, ${rectH}, ${color});`);
                    }
                });
            }
        }
        lines.push("      }");
    });

    // === Font Validation ===
    // Check for fonts used in lambda but not defined in font: section
    const missingFonts = [];
    for (const fontId of usedFontIds) {
        if (!definedFontIds.has(fontId)) {
            missingFonts.push(fontId);
        }
    }

    if (missingFonts.length > 0) {
        // Create warning block to prepend to output
        const warningLines = [
            "# ╔════════════════════════════════════════════════════════════════════════╗",
            "# ║  ⚠️  FONT VALIDATION WARNING                                            ║",
            "# ╠════════════════════════════════════════════════════════════════════════╣",
            "# ║  The following font IDs are used in the display lambda but are NOT     ║",
            "# ║  defined in the font: section. This will cause ESPHome compile errors! ║",
            "# ╠════════════════════════════════════════════════════════════════════════╣"
        ];
        for (const fontId of missingFonts) {
            const paddedId = fontId.padEnd(66, " ");
            warningLines.push(`# ║  - ${paddedId} ║`);
        }
        warningLines.push("# ╠════════════════════════════════════════════════════════════════════════╣");
        warningLines.push("# ║  Please ensure all fonts used by widgets are properly defined.        ║");
        warningLines.push("# ╚════════════════════════════════════════════════════════════════════════╝");
        warningLines.push("");

        return warningLines.join("\n") + "\n" + lines.join("\n");
    }

    return lines.join("\n");
}

function generateScriptSection(payload, pagesLocal) {
    const lines = [];

    // Manual refresh only mode - minimal script
    if (payload.manual_refresh_only) {
        lines.push("script:");
        lines.push("  - id: manage_run_and_sleep");
        lines.push("    mode: restart");
        lines.push("    then:");
        lines.push("      - logger.log: \"Manual refresh only mode. Auto-refresh loop disabled.\"");
        return lines.join("\n");
    }

    // Deep Sleep mode - simple script: update then sleep
    if (payload.deep_sleep_enabled) {
        lines.push("script:");
        lines.push("  - id: manage_run_and_sleep");
        lines.push("    mode: restart");
        lines.push("    then:");
        lines.push("      # Update screen immediately");
        lines.push("      - component.update: epaper_display");
        lines.push("      ");
        lines.push("      # Enter deep sleep (wakes up after sleep_duration)");
        lines.push("      - deep_sleep.enter: deep_sleep_1");
        return lines.join("\n");
    }

    // Build per-page interval cases
    const casesLines = [];
    for (let idx = 0; idx < pagesLocal.length; idx++) {
        const page = pagesLocal[idx];
        const refreshS = page.refresh_s;
        if (refreshS !== undefined && refreshS !== null) {
            const val = parseInt(refreshS, 10);
            if (!isNaN(val) && val > 0) {
                casesLines.push(`                  case ${idx}: interval = ${val}; break;`);
            }
        }
    }

    const casesBlock = casesLines.length > 0
        ? casesLines.join("\n")
        : "                  default:\n                    break;";

    // Sleep logic
    let sleepLogic = "";
    if (payload.sleep_enabled) {
        const startH = parseInt(payload.sleep_start_hour || 0, 10);
        const endH = parseInt(payload.sleep_end_hour || 5, 10);

        // Handle wrap-around time (e.g. 22:00 to 06:00)
        const condition = startH > endH
            ? `(now.hour >= ${startH} || now.hour < ${endH})`
            : `(now.hour >= ${startH} && now.hour < ${endH})`;

        sleepLogic = `
      # Night Mode Check (${String(startH).padStart(2, '0')}:00 - ${String(endH).padStart(2, '0')}:00)
      - if:
          condition:
            lambda: |-
              auto now = id(ha_time).now();
              if (!now.is_valid()) {
                return false;
              }
              // Deep sleep only between ${String(startH).padStart(2, '0')}:00 and ${String(endH).padStart(2, '0')}:00
              // But skip if it's exactly the top of the hour (we just woke up to refresh)
              return ${condition} && !(now.minute == 0);
          then:
            - lambda: |-
                auto now = id(ha_time).now();
                if (now.is_valid()) {
                  ESP_LOGI("sleep", "Deep sleep mode %02d:%02d", now.hour, now.minute);
                }
            - if:
                condition:
                  lambda: |-
                    auto now = id(ha_time).now();
                    return now.is_valid() && (now.minute == 0);
                then:
                  - component.update: epaper_display
                else:
                  - logger.log: "Deep sleep mode: skipping refresh until the top of the hour."
            - deep_sleep.enter:
                id: deep_sleep_1
                sleep_duration: 60min
          
          # Active Mode
          else:`;
    } else {
        // No sleep mode
        sleepLogic = `
      # Sleep mode disabled
      - if:
          condition:
            lambda: 'return false;'
          then:
            - delay: 1s
          else:`;
    }

    // No-refresh window logic
    let noRefreshLogic = "";
    const nrStart = payload.no_refresh_start_hour;
    const nrEnd = payload.no_refresh_end_hour;

    if (nrStart !== undefined && nrStart !== null && nrEnd !== undefined && nrEnd !== null) {
        const sH = parseInt(nrStart, 10);
        const eH = parseInt(nrEnd, 10);
        // Only generate if start != end (avoid 0-0 case)
        if (!isNaN(sH) && !isNaN(eH) && sH !== eH) {
            const cond = sH > eH
                ? `(now.hour >= ${sH} || now.hour < ${eH})`
                : `(now.hour >= ${sH} && now.hour < ${eH})`;

            noRefreshLogic = `
            - if:
                condition:
                  lambda: |-
                    auto now = id(ha_time).now();
                    return now.is_valid() && ${cond};
                then:
                  - logger.log: "In no-refresh window. Skipping display update."
                  - delay: 60s
                  - script.execute: manage_run_and_sleep
            `;
        }
    }

    // Build image trigger logic
    const imageCases = [];
    for (let idx = 0; idx < pagesLocal.length; idx++) {
        const page = pagesLocal[idx];
        const pageImages = [];
        if (page.widgets) {
            for (const w of page.widgets) {
                const t = (w.type || "").toLowerCase();
                if (t === "online_image") {
                    pageImages.push(`online_image_${w.id}`.replace(/-/g, "_"));
                } else if (t === "puppet") {
                    pageImages.push(`puppet_${w.id}`.replace(/-/g, "_"));
                }
            }
        }
        if (pageImages.length > 0) {
            const updates = pageImages.map(pid => `id(${pid}).update();`).join(" ");
            imageCases.push(`                  case ${idx}: ${updates} triggered = true; break;`);
        }
    }

    let updateLambda = "";
    if (imageCases.length > 0) {
        updateLambda = [
            "            - lambda: |-",
            "                bool triggered = false;",
            "                int page = id(display_page);",
            "                switch (page) {",
            imageCases.join("\n"),
            "                }",
            "                if (!triggered) {",
            "                  id(epaper_display).update();",
            "                }"
        ].join("\n");
    } else {
        updateLambda = "            - component.update: epaper_display";
    }

    // Assemble the full script
    lines.push("script:");
    lines.push("  - id: manage_run_and_sleep");
    lines.push("    mode: restart");
    lines.push("    then:");
    lines.push("      - wait_until:");
    lines.push("          condition:");
    lines.push("            lambda: 'return id(ha_time).now().is_valid();'");
    lines.push("          timeout: 120s");
    lines.push(sleepLogic);
    lines.push("            - lambda: |-");
    lines.push("                int page = id(display_page);");
    lines.push("                int interval = id(page_refresh_default_s);");
    lines.push("                switch (page) {");
    lines.push(casesBlock);
    lines.push("                }");
    lines.push("                if (interval < 60) {");
    lines.push("                  interval = 60;");
    lines.push("                }");
    lines.push("                id(page_refresh_current_s) = interval;");
    lines.push("                ESP_LOGI(\"refresh\", \"Next refresh in %d seconds for page %d\", interval, page);");
    lines.push("            ");
    lines.push(noRefreshLogic);
    lines.push(updateLambda);
    lines.push("      ");
    lines.push("            - delay: !lambda 'return id(page_refresh_current_s) * 1000;'");
    lines.push("            ");
    lines.push("            - script.execute: manage_run_and_sleep");

    return lines.join("\n");
}

// Global variables for snippet highlighting
window.lastHighlightRange = null;
window.isAutoHighlight = false;

/**
 * Highlights a widget's YAML block in the snippet editor.
 * @param {string} widgetId 
 */
function highlightWidgetInSnippet(widgetId) {
    const box = document.getElementById("snippetBox");
    if (!box) return;

    const yaml = box.value;
    if (!yaml) return;

    // Search for the widget ID in the comments
    // Format: // widget:type id:w_123 ...
    const targetStr = `id:${widgetId} `;
    const index = yaml.indexOf(targetStr);

    if (index !== -1) {
        // Find the start of the line containing the ID
        const lineStart = yaml.lastIndexOf('\n', index) + 1;

        // Find the next widget marker to determine block end
        const nextWidgetIndex = yaml.indexOf("// widget:", index + targetStr.length);
        let blockEnd = nextWidgetIndex !== -1 ? nextWidgetIndex : yaml.length;

        // If there's a next widget, back up to the previous newline to avoid selecting the next widget's comment
        if (nextWidgetIndex !== -1) {
            blockEnd = yaml.lastIndexOf('\n', nextWidgetIndex) + 1;
        }

        // Check if user is typing in a property field
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
        const isTyping = (activeTag === "input" || activeTag === "textarea") && document.activeElement !== box;

        // Only steal focus if NOT typing in properties
        // This allows auto-highlight on widget add while preventing interruption when editing properties
        if (!isTyping) {
            window.isAutoHighlight = true;
            box.focus();
        }

        // Use "backward" to keep the cursor/focus at the start of the selection
        // This helps prevent the browser from scrolling to the bottom of the block
        try {
            box.setSelectionRange(lineStart, blockEnd, "backward");
        } catch (e) {
            // Fallback for browsers that don't support direction
            box.setSelectionRange(lineStart, blockEnd);
        }

        window.lastHighlightRange = { start: lineStart, end: blockEnd };

        // Scroll to selection with a slight delay to override browser default behavior
        // setTimeout is often more reliable than requestAnimationFrame for overriding focus scrolling
        setTimeout(() => {
            const lines = yaml.substring(0, lineStart).split('\n');
            const totalLines = yaml.split('\n').length;
            const lineNum = lines.length;

            // Calculate dynamic line height based on actual rendered height
            // This works for ANY font size (online or offline)
            const lineHeight = box.scrollHeight / totalLines;

            // Scroll to center the line
            box.scrollTop = (lineNum * lineHeight) - (box.clientHeight / 3);
        }, 10);
    }
}

// Add listeners to reset auto-highlight when user interacts with the box
document.addEventListener("DOMContentLoaded", () => {
    const box = document.getElementById("snippetBox");
    if (box) {
        const resetHighlight = () => {
            window.isAutoHighlight = false;
        };
        box.addEventListener("mousedown", resetHighlight);
        box.addEventListener("input", resetHighlight);
        box.addEventListener("keydown", (e) => {
            // Reset on navigation keys but NOT on copy/paste shortcuts
            if (!e.ctrlKey && !e.metaKey) {
                window.isAutoHighlight = false;
            }
        });
    }
});

// Expose globally
window.generateSnippetLocally = generateSnippetLocally;
window.highlightWidgetInSnippet = highlightWidgetInSnippet;
