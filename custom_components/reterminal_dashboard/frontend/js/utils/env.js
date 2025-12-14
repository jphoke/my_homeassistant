/**
 * Detects the Home Assistant backend URL.
 * @returns {string|null} The API base URL or null.
 */
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

/**
 * Checks if the HA backend is available.
 * @returns {boolean}
 */
function hasHaBackend() {
    return !!HA_API_BASE;
}
