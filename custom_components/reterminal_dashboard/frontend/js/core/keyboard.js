// Keyboard Shortcuts Handler
// Ported from editor.js

class KeyboardHandler {
    constructor() {
        this.init();
    }

    init() {
        window.addEventListener("keydown", (ev) => this.handleKeyDown(ev));
    }

    handleKeyDown(ev) {
        const selectedWidgetId = AppState.selectedWidgetId;
        const isAutoHighlight = window.isAutoHighlight || false; // Global flag from snippet editor

        // Delete / Backspace
        if ((ev.key === "Delete" || ev.key === "Backspace") && selectedWidgetId) {
            // Special case: If snippet box is focused but selection matches the auto-highlight,
            // treat it as a widget delete.
            const lastHighlightRange = window.lastHighlightRange;
            if (ev.target.id === "snippetBox" && lastHighlightRange) {
                if (ev.target.selectionStart === lastHighlightRange.start &&
                    ev.target.selectionEnd === lastHighlightRange.end) {
                    ev.preventDefault();
                    this.deleteWidget(selectedWidgetId);
                    return;
                }
            }

            if (ev.target.tagName === "INPUT" || ev.target.tagName === "TEXTAREA") {
                return;
            }
            ev.preventDefault();
            this.deleteWidget(selectedWidgetId);
            return;
        }

        // Copy: Ctrl+C
        if ((ev.ctrlKey || ev.metaKey) && ev.key === "c") {
            if (ev.target.tagName === "INPUT" || ev.target.tagName === "TEXTAREA") {
                if (ev.target.id === "snippetBox" && isAutoHighlight) {
                    ev.preventDefault();
                    this.copyWidget();
                    return;
                }
                return;
            }
            ev.preventDefault();
            this.copyWidget();
        }

        // Paste: Ctrl+V
        if ((ev.ctrlKey || ev.metaKey) && ev.key === "v") {
            if (ev.target.tagName === "INPUT" || ev.target.tagName === "TEXTAREA") {
                if (ev.target.id === "snippetBox" && isAutoHighlight) {
                    ev.preventDefault();
                    this.pasteWidget();
                    return;
                }
                return;
            }
            ev.preventDefault();
            this.pasteWidget();
        }

        // Undo: Ctrl+Z
        if ((ev.ctrlKey || ev.metaKey) && ev.key === "z" && !ev.shiftKey) {
            ev.preventDefault();
            AppState.undo();
        }

        // Redo: Ctrl+Y or Ctrl+Shift+Z
        if ((ev.ctrlKey || ev.metaKey) && (ev.key === "y" || (ev.key === "z" && ev.shiftKey))) {
            ev.preventDefault();
            AppState.redo();
        }
    }

    deleteWidget(widgetId) {
        AppState.deleteWidget(widgetId);
    }

    copyWidget() {
        AppState.copyWidget();
    }

    pasteWidget() {
        AppState.pasteWidget();
    }
}

// Initialize globally
window.KeyboardHandler = KeyboardHandler;
