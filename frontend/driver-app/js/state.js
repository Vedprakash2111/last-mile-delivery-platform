

export const appRoot = document.getElementById("app-content");

export const toastRegion = document.getElementById("toast-region");

export const localPreviewRoutes = [
    {
        route_id: "local-preview-route-01",
        status: "planned",
        version: 1,
        title: "Sample north loop",
        area: "Preview area",
        stop_count: 2,
        distance_km: 8.4,
        duration_min: 75,
        pickup: "Sample pickup hub",
        pickup_code: "PREVIEW-01",
        vehicle_id: "local-preview-vehicle",
        vehicle_registration: "PREVIEW ONLY",
        is_preview: true,
        stops: [
            { order_id: "preview-order-01", sequence: 1, tracking_token: "PREVIEW-ORDER-01", recipient: "Sample recipient one", recipient_phone: null, address: "Sample delivery address one", window: "Preview time window", status: "pending" },
            { order_id: "preview-order-02", sequence: 2, tracking_token: "PREVIEW-ORDER-02", recipient: "Sample recipient two", recipient_phone: null, address: "Sample delivery address two", window: "Preview time window", status: "pending" }
        ]
    }
];

export const state = {
    db: null,
    view: "login",
    tab: "Today",
    deliveriesFilter: "All",
    previewMode: false,
    loginMessage: "",
    identity: null,
    driverUserId: null,
    route: null,
    pickedUp: false,
    pickupScanned: new Set(),
    stopScanned: new Set(),
    completed: new Set(),
    failed: new Set(),
    arrived: new Set(),
    location: null,
    locationStatus: "Location not shared",
    outboxCount: 0,
    isSyncing: false,
    syncRequested: false,
    settings: readSettings(),
    driverProfile: null,
    driverRoutes: [],
    vehicles: []
};

export function readSettings() {
    try {
        return JSON.parse(localStorage.getItem("driver.settings") || "{}");
    } catch (error) {
        console.error("Could not read saved driver settings.", error);
        return {};
    }
}

export function saveSettings() {
    localStorage.setItem("driver.settings", JSON.stringify(state.settings));
}

export function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

export function formatCount(value, singular, plural = `${singular}s`) {
    return `${value} ${value === 1 ? singular : plural}`;
}

export function notify(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastRegion.append(toast);
    window.setTimeout(() => toast.remove(), 3600);
}

export function showError(message) {
    const error = document.getElementById("screen-error");
    if (error) {
        error.textContent = message;
        error.hidden = false;
    } else {
        notify(message, "error");
    }
}
