// Imports removed - using global scope
// generateId from helpers.js
// AppState from state.js
// getDeviceModel from device.js

class WidgetFactory {
    static createWidget(type) {
        const id = generateId();
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

        // Default properties based on type
        switch (type) {
            case "label":
            case "text":
                widget.type = "text";
                widget.props = {
                    text: "Text",
                    font_size: 20,
                    font_family: "Roboto",
                    color: "black",
                    font_weight: 400,
                    italic: false,
                    bpp: 1,
                    text_align: "TOP_LEFT"
                };
                break;

            case "sensor_text":
                widget.type = "sensor_text";
                widget.props = {
                    label_font_size: 14,
                    value_font_size: 20,
                    value_format: "label_value",
                    color: "black",
                    font_family: "Roboto",
                    font_weight: 400,
                    italic: false,
                    unit: "",
                    precision: -1,
                    text_align: "TOP_LEFT",
                    label_align: "TOP_LEFT",
                    value_align: "TOP_LEFT"
                };
                break;

            case "datetime":
                widget.width = 200;
                widget.height = 60;
                widget.props = {
                    format: "time_date",
                    time_font_size: 28,
                    date_font_size: 16,
                    color: "black",
                    italic: false,
                    font_family: "Roboto"
                };
                break;

            case "progress_bar":
                widget.width = 200;
                widget.height = 40;
                widget.props = {
                    show_label: true,
                    show_percentage: true,
                    bar_height: 15,
                    border_width: 1,
                    color: "black"
                };
                break;

            case "battery_icon":
                widget.width = 60;
                widget.height = 60;
                widget.props = {
                    size: 24,
                    font_size: 12,  // Font size for the percentage label
                    color: "black"
                };
                break;

            case "weather_icon":
                widget.width = 48;
                widget.height = 48;
                widget.entity_id = "weather.forecast_home";  // Default HAOS weather entity
                widget.props = {
                    size: 48,
                    color: "black",
                    icon_map: "default"
                };
                break;

            case "weather_forecast":
                widget.width = 400;
                widget.height = 80;
                widget.entity_id = "weather.forecast_home";  // Default HAOS weather entity
                widget.props = {
                    layout: "horizontal",  // or "vertical"
                    days: 5,
                    icon_size: 32,
                    temp_font_size: 14,
                    day_font_size: 12,
                    color: "black",
                    show_high_low: true,
                    font_family: "Roboto"
                };
                break;

            case "puppet":
                widget.props = {
                    image_url: "",
                    invert: false,
                    image_type: "RGB565",
                    transparency: "opaque"
                };
                break;

            case "shape_rect":
                widget.props = {
                    fill: false,
                    border_width: 1,
                    color: "black",
                    opacity: 100
                };
                break;

            case "rounded_rect":
                widget.width = 100;
                widget.height = 80;
                widget.props = {
                    radius: 10,
                    border_width: 4,
                    fill: false,
                    color: "black",
                    opacity: 100
                };
                break;

            case "shape_circle":
                widget.width = 40;
                widget.height = 40;
                widget.props = {
                    fill: false,
                    border_width: 1,
                    color: "black",
                    opacity: 100
                };
                break;

            case "icon":
                widget.width = 60;
                widget.height = 60;
                widget.props = {
                    code: "F0595",
                    size: 40,
                    color: "black",
                    font_ref: "font_mdi_medium",
                    fit_icon_to_frame: true
                };
                break;

            case "line":
                widget.width = 100;
                widget.height = 3;
                widget.props = {
                    stroke_width: 3,
                    color: "black",
                    orientation: "horizontal"
                };
                break;

            case "image":
                widget.width = 200;
                widget.height = 150;
                widget.props = {
                    path: "",
                    invert: (getDeviceModel() === "reterminal_e1001"),
                    render_mode: "Auto"
                };
                break;

            case "online_image":
                widget.width = 800;
                widget.height = 480;
                widget.props = {
                    url: "",
                    invert: (getDeviceModel() === "reterminal_e1001"),
                    render_mode: "Auto",
                    interval_s: 300
                };
                break;

            case "graph":
                widget.width = 200;
                widget.height = 100;
                widget.props = {
                    duration: "1h",
                    border: true,
                    grid: true,
                    color: "black",
                    title: "",
                    x_grid: "",
                    y_grid: "",
                    line_thickness: 3,
                    line_type: "SOLID",
                    continuous: true,
                    min_value: "",
                    max_value: "",
                    min_range: "",
                    max_range: ""
                };
                break;

            case "qr_code":
                widget.width = 100;
                widget.height = 100;
                widget.props = {
                    value: "https://esphome.io",
                    scale: 2,
                    ecc: "LOW",
                    color: "black"
                };
                break;
        }

        return widget;
    }
}
