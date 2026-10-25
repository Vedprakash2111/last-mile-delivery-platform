import { state, localPreviewRoutes, notify, showError, saveSettings } from "../state.js";
import { clearWorkState, persistWorkState } from "../storage.js";
import { apiRequest, normalizeDriverRoute } from "../api.js";
import { render } from "../views.js";
import { syncOutbox } from "./driver-events.js";

export function enterLocalPreview() {
    if (!["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)) {
        showError("Local preview is available only when running the app on this device.");
        return;
    }
    state.previewMode = true;
    state.loginMessage = "";
    state.identity = { full_name: "Preview Driver", email: "preview@example.test", driver_status: "available" };
    state.driverUserId = null;
    state.driverProfile = { status: "available", vehicle: null };
    state.driverRoutes = localPreviewRoutes;
    state.vehicles = [];
    state.route = null;
    state.pickedUp = false;
    state.pickupScanned = new Set();
    state.stopScanned = new Set();
    state.completed = new Set();
    state.failed = new Set();
    state.arrived = new Set();
    state.view = "app";
    state.tab = "Today";
    render();
    notify("Local preview only: synthetic data, no database access.", "info");
}

export function exitLocalPreview() {
    if (!state.previewMode) return;
    state.previewMode = false;
    state.loginMessage = "";
    state.identity = null;
    state.driverUserId = null;
    state.driverProfile = null;
    state.driverRoutes = [];
    state.vehicles = [];
    state.route = null;
    state.view = "login";
    render();
}

export async function loadDriverAccount(identity) {
    const [profile, routes, vehicles] = await Promise.all([
        apiRequest("/driver/profile"),
        apiRequest("/driver/routes"),
        apiRequest("/driver/vehicles")
    ]);
    state.identity = {
        ...identity,
        user_id: profile.user_id,
        full_name: profile.full_name,
        phone: profile.phone,
        driver_status: profile.status
    };
    state.driverUserId = profile.user_id;
    state.driverProfile = profile;
    state.driverRoutes = routes.map(normalizeDriverRoute);
    state.vehicles = vehicles;
    const serverRoute = state.driverRoutes.find((route) => route.status === "in_progress") || null;
    const savedRoute = state.route;
    state.route = serverRoute;
    if (serverRoute) {
        state.pickedUp = savedRoute?.route_id === serverRoute.route_id && state.pickedUp;
        if (savedRoute?.route_id !== serverRoute.route_id) {
            state.pickupScanned = new Set();
            state.stopScanned = new Set();
            state.completed = new Set(serverRoute.stops.filter((stop) => stop.status === "delivered").map((stop) => stop.order_id));
            state.failed = new Set(serverRoute.stops.filter((stop) => stop.status === "failed").map((stop) => stop.order_id));
            state.arrived = new Set();
        }
        await persistWorkState();
    } else {
        state.pickedUp = false;
        state.pickupScanned = new Set();
        state.stopScanned = new Set();
        state.completed = new Set();
        state.failed = new Set();
        state.arrived = new Set();
        await clearWorkState();
    }
}

export async function searchVehicles() {
    const search = document.getElementById("vehicle-search")?.value.trim() || "";
    try {
        state.vehicles = await apiRequest(
            `/driver/vehicles${search ? `?search=${encodeURIComponent(search)}` : ""}`
        );
        render();
        notify(search ? "Vehicle search updated." : "Available vehicles refreshed.", "success");
    } catch (error) {
        notify(error.message || "Could not search available vehicles.", "error");
    }
}

export async function login(form) {
    const values = new FormData(form);
    const identifier = String(values.get("identifier")).trim();
    const password = String(values.get("password"));
    const payload = { password };
    if (identifier.includes("@")) payload.email = identifier;
    else payload.phone = identifier;
    try {
        state.loginMessage = "";
        const session = await apiRequest("/auth/login", { method: "POST", body: JSON.stringify(payload) });
        if (!session.roles?.includes("driver")) throw new Error("This account does not have a driver role.");
        const identity = await apiRequest("/auth/me");
        await loadDriverAccount(identity);
        state.previewMode = false;
        state.view = "app";
        state.tab = "Today";
        sessionStorage.setItem("driver.hasSession", "true");
        render();
        notify("You're signed in. Have a great shift.", "success");
        await syncOutbox({ quiet: true });
    } catch (error) {
        showError(error.message || "Could not sign in. Check your details and connection.");
    }
}

export async function register(form) {
    const values = new FormData(form);
    const payload = {
        full_name: String(values.get("full_name")).trim(),
        email: String(values.get("email")).trim(),
        password: String(values.get("password"))
    };
    const phone = String(values.get("phone")).trim();
    if (phone) payload.phone = phone;
    try {
        await apiRequest("/auth/register/driver", { method: "POST", body: JSON.stringify(payload) });
        state.view = "login";
        render();
        notify("Account created. Sign in to continue.", "success");
    } catch (error) {
        showError(error.message || "Could not create the driver account.");
    }
}

export async function signOut() {
    try {
        await apiRequest("/auth/logout", { method: "POST", body: "{}" });
    } catch (error) {
        console.error("Could not revoke the server session.", error);
        notify(`Signed out locally; server logout failed: ${error.message}`, "error");
    }
    state.identity = null;
    state.driverUserId = null;
    state.route = null;
    state.completed = new Set();
    state.failed = new Set();
    state.arrived = new Set();
    state.pickupScanned = new Set();
    state.stopScanned = new Set();
    state.pickedUp = false;
    await clearWorkState();
    state.view = "login";
    sessionStorage.removeItem("driver.hasSession");
    render();
}

export async function finishRoute() {
    if (!state.route) return;
    if (state.outboxCount) await syncOutbox({ quiet: true });
    if (state.outboxCount) {
        notify("Route updates are still waiting to sync. Keep the route open until they are accepted.", "error");
        return;
    }
    try {
        const routes = await apiRequest("/driver/routes");
        if (routes.some((route) => route.route_id === state.route.route_id)) {
            notify("The delivery updates are still being processed. Try again shortly.", "info");
            return;
        }
        state.driverProfile.status = "available";
    } catch (error) {
        notify(`Could not confirm route completion: ${error.message}`, "error");
        return;
    }
    state.route = null;
    state.pickedUp = false;
    state.pickupScanned = new Set();
    state.stopScanned = new Set();
    state.completed = new Set();
    state.failed = new Set();
    state.arrived = new Set();
    await clearWorkState();
    state.tab = "Today";
    render();
    notify("Route completion confirmed.", "success");
}

export function saveGatewayUrl() {
    const input = document.getElementById("driver-gateway-url");
    if (!input?.value.trim()) {
        showError("Enter the Driver Gateway base URL.");
        return;
    }
    state.settings.driverGatewayBase = input.value.trim().replace(/\/+$/, "");
    saveSettings();
    notify("Driver Gateway URL saved on this device.", "success");
}

export async function saveProfileSettings() {
    const gatewayUrl = document.getElementById("gateway-api-url")?.value.trim();
    const googleMapsEmbedKey = document.getElementById("google-maps-embed-key")?.value.trim();
    const vehicle = document.getElementById("vehicle-registration")?.value || "";
    try {
        const fullName = document.getElementById("driver-full-name")?.value.trim();
        const phone = document.getElementById("driver-phone")?.value.trim();
        const profileChanges = {};
        if (fullName && fullName !== state.identity.full_name) profileChanges.full_name = fullName;
        if (phone && phone !== state.identity.phone) profileChanges.phone = phone;
        if (Object.keys(profileChanges).length) {
            state.driverProfile = await apiRequest("/driver/profile", {
                method: "PATCH",
                body: JSON.stringify(profileChanges)
            });
            state.identity.full_name = state.driverProfile.full_name;
            state.identity.phone = state.driverProfile.phone;
        }

        if (vehicle && vehicle !== state.driverProfile.vehicle?.vehicle_id) {
            state.driverProfile = await apiRequest("/driver/vehicle", {
                method: "PUT",
                body: JSON.stringify({ vehicle_id: vehicle })
            });
            state.vehicles = await apiRequest("/driver/vehicles");
        }

        if (gatewayUrl) state.settings.driverGatewayBase = gatewayUrl.replace(/\/+$/, "");
        if (googleMapsEmbedKey) {
            state.settings.googleMapsEmbedKey = googleMapsEmbedKey;
        } else {
            delete state.settings.googleMapsEmbedKey;
        }
        saveSettings();
        render();
        notify("Profile settings saved.", "success");
    } catch (error) {
        notify(error.message || "Could not save profile settings.", "error");
    }
}
