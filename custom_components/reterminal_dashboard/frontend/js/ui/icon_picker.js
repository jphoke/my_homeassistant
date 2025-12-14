import { ReTerminalIcons } from '../data/icons.js';
import { appState } from '../core/state.js';

let pickerModal = null;
let pickerFilter = null;
let pickerList = null;
let pickerClose = null;
let currentWidget = null;
let currentInput = null;

/**
 * Initializes the icon picker modal elements.
 */
function initPicker() {
    if (pickerModal) return;

    // Create modal structure if it doesn't exist in HTML
    // For now, we assume the structure exists or we create it dynamically.
    // Let's try to find existing elements first (legacy support)
    pickerModal = document.getElementById('iconPickerModal');
    pickerFilter = document.getElementById('iconPickerFilter');
    pickerList = document.getElementById('iconPickerList');
    pickerClose = document.getElementById('iconPickerClose');

    if (!pickerModal) {
        // Create dynamic modal
        pickerModal = document.createElement('div');
        pickerModal.id = 'iconPickerModal';
        pickerModal.className = 'modal hidden';
        pickerModal.innerHTML = `
            <div class="modal-content" style="max-width: 500px; max-height: 80vh; display: flex; flex-direction: column;">
                <div class="modal-header">
                    <h3>Select Icon</h3>
                    <button id="iconPickerClose" class="btn-close">×</button>
                </div>
                <div class="modal-body" style="flex: 1; overflow: hidden; display: flex; flex-direction: column;">
                    <input type="text" id="iconPickerFilter" placeholder="Filter icons..." style="width: 100%; margin-bottom: 10px; padding: 8px;">
                    <div id="iconPickerList" style="flex: 1; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px; display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 8px; padding: 8px;"></div>
                </div>
            </div>
        `;
        document.body.appendChild(pickerModal);

        pickerFilter = document.getElementById('iconPickerFilter');
        pickerList = document.getElementById('iconPickerList');
        pickerClose = document.getElementById('iconPickerClose');
    }

    if (pickerClose) {
        pickerClose.onclick = closeIconPicker;
    }

    if (pickerFilter) {
        pickerFilter.oninput = (e) => filterIcons(e.target.value);
    }

    // Close on click outside
    pickerModal.onclick = (e) => {
        if (e.target === pickerModal) closeIconPicker();
    };
}

/**
 * Opens the icon picker for a specific widget.
 * @param {Object} widget - The widget to update.
 * @param {HTMLInputElement} inputElement - The input element to update visually.
 */
export function openIconPickerForWidget(widget, inputElement) {
    initPicker();
    currentWidget = widget;
    currentInput = inputElement;

    pickerModal.classList.remove('hidden');
    pickerModal.style.display = 'flex';

    if (pickerFilter) {
        pickerFilter.value = '';
        pickerFilter.focus();
    }

    renderIconList(ReTerminalIcons);
}

/**
 * Closes the icon picker modal.
 */
export function closeIconPicker() {
    if (pickerModal) {
        pickerModal.classList.add('hidden');
        pickerModal.style.display = 'none';
    }
    currentWidget = null;
    currentInput = null;
}

/**
 * Renders the list of icons.
 * @param {Array} icons 
 */
function renderIconList(icons) {
    if (!pickerList) return;
    pickerList.innerHTML = '';

    if (!icons || icons.length === 0) {
        pickerList.innerHTML = '<div style="padding: 10px; color: var(--text-muted); grid-column: 1 / -1;">No icons found.</div>';
        return;
    }

    const fragment = document.createDocumentFragment();

    icons.forEach(icon => {
        const item = document.createElement('div');
        item.className = 'icon-item';
        item.style.padding = '8px';
        item.style.border = '1px solid var(--border-color)';
        item.style.borderRadius = '4px';
        item.style.cursor = 'pointer';
        item.style.display = 'flex';
        item.style.flexDirection = 'column';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'center';
        item.style.textAlign = 'center';
        item.title = icon.name;

        // Since we don't have the actual font loaded in this context easily for preview without classes,
        // we might just show the name or a placeholder. 
        // But wait, the editor loads the font.
        // We can use a span with the correct font family.
        // Assuming 'Material Design Icons' is loaded or we use the codepoint.

        const iconPreview = document.createElement('div');
        iconPreview.style.fontFamily = '"Material Design Icons"';
        iconPreview.style.fontSize = '24px';
        iconPreview.innerHTML = `&#x${icon.code};`; // Use HTML entity

        const iconName = document.createElement('div');
        iconName.style.fontSize = '10px';
        iconName.style.marginTop = '4px';
        iconName.style.overflow = 'hidden';
        iconName.style.textOverflow = 'ellipsis';
        iconName.style.whiteSpace = 'nowrap';
        iconName.style.width = '100%';
        iconName.textContent = icon.name.replace('mdi:', '');

        item.appendChild(iconPreview);
        item.appendChild(iconName);

        item.onclick = () => selectIcon(icon);
        fragment.appendChild(item);
    });

    pickerList.appendChild(fragment);
}

/**
 * Filters the displayed icons.
 * @param {string} query 
 */
function filterIcons(query) {
    if (!query) {
        renderIconList(ReTerminalIcons);
        return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = ReTerminalIcons.filter(icon =>
        icon.name.toLowerCase().includes(lowerQuery)
    );
    renderIconList(filtered);
}

/**
 * Handles icon selection.
 * @param {Object} icon 
 */
function selectIcon(icon) {
    if (currentWidget) {
        // If we have an input element, we update it and trigger input event
        if (currentInput) {
            // We usually store the code (Fxxxx) or the name?
            // The widget props usually expect the code for rendering, but maybe the name for UI?
            // Let's check how it was used.
            // In editor.js: widget.props.code = icon.code;

            // If the input is for the "code" property, we set the code.
            // If it's for the "name" (if any), we set the name.
            // Usually the properties panel binds to specific props.
            // Let's assume the input value should be the code.
            currentInput.value = icon.code;
            currentInput.dispatchEvent(new Event('input'));
            currentInput.dispatchEvent(new Event('change'));
        } else {
            // Fallback: update widget directly and refresh
            if (!currentWidget.props) currentWidget.props = {};
            currentWidget.props.code = icon.code;
            appState.updateWidget(currentWidget.id, currentWidget);
        }
    }
    closeIconPicker();
}
