import { state, appRoot, escapeHTML, notify } from "./state.js";
import { openDatabase, restoreWorkState, refreshOutboxCount, removeLegacyDemoData } from "./storage.js";
import { apiRequest } from "./api.js";
import { render } from "./views.js";
import { syncOutbox, acceptRoute, confirmPickup, scanPickupParcel, scanStopParcel, arriveAtStop, openDelivery, openException, openRouteDetails, startLocation } from "./services/driver-events.js";
import { enterLocalPreview, exitLocalPreview, loadDriverAccount, searchVehicles, login, register, signOut, finishRoute, saveGatewayUrl, saveProfileSettings } from "./services/account.js";

async function startApp() {
    try {
        state.db = await openDatabase();
        await removeLegacyDemoData();
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("/driver-app-sw.js", { scope: "/" }).catch((error) => {
                console.error("Could not register the offline app shell.", error);
                notify("Offline app shell could not be installed.", "error");
            });
        }
        await restoreWorkState();
        if (sessionStorage.getItem("driver.hasSession") === "true") {
            try {
                const identity = await apiRequest("/auth/me");
                if (identity.roles?.includes("driver")) {
                    await loadDriverAccount(identity);
                    state.view = "app";
                } else {
                    sessionStorage.removeItem("driver.hasSession");
                }
            } catch (error) {
                console.warn("Saved driver session could not be restored.", error);
                sessionStorage.removeItem("driver.hasSession");
                state.loginMessage = "Your saved session could not be restored. Sign in again.";
            }
        }
        await refreshOutboxCount();
        render();
        if (state.view === "app") await syncOutbox({ quiet: true });
    } catch (error) {
        console.error("Driver app initialization failed.", error);
        appRoot.innerHTML = `<main class="fatal-state"><div class="brand-mark">F<span>·</span></div><h1>Couldn't prepare offline storage</h1><p>${escapeHTML(error.message)}</p><button class="button button-primary" onclick="window.location.reload()">Try again</button></main>`;
    }
}

document.addEventListener("click", async (event) => {
    const deliveryFilter = event.target.closest("[data-delivery-filter]");
    if (deliveryFilter) {
        state.deliveriesFilter = deliveryFilter.dataset.deliveryFilter;
        render();
        return;
    }
    const tabButton = event.target.closest("[data-tab]");
    if (tabButton) {
        state.tab = tabButton.dataset.tab;
        render();
        return;
    }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const { action } = button.dataset;
    if (action === "show-register") { state.view = "register"; render(); }
    if (action === "show-login") { state.view = "login"; render(); }
    if (action === "enter-local-preview") enterLocalPreview();
    if (action === "exit-local-preview") exitLocalPreview();
    if (action === "finish-route") await finishRoute();
    if (action === "go-home") { event.preventDefault(); state.tab = "Today"; render(); }
    if (action === "go-route") { state.tab = "Route"; render(); }
    if (action === "view-route") openRouteDetails(button.dataset.route);
    if (action === "accept-route") {
        button.closest("dialog")?.close();
        await acceptRoute(button.dataset.route);
    }
    if (action === "arrive-stop") await arriveAtStop(button.dataset.order);
    if (action === "scan-pickup") await scanPickupParcel();
    if (action === "confirm-pickup") await confirmPickup();
    if (action === "scan-stop") await scanStopParcel(button.dataset.order);
    if (action === "open-delivery") openDelivery(button.dataset.order);
    if (action === "open-exception") openException(button.dataset.order);
    if (action === "sync") await syncOutbox();
    if (action === "start-location") await startLocation();
    if (action === "search-vehicles") await searchVehicles();
    if (action === "sign-out") await signOut();
    if (action === "save-gateway-url") saveGatewayUrl();
    if (action === "save-profile-settings") saveProfileSettings();
    if (action === "close-dialog") button.closest("dialog")?.close();
});

document.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (event.target.id === "login-form") await login(event.target);
    if (event.target.id === "register-form") await register(event.target);
});

window.addEventListener("online", async () => {
    if (state.view === "app") {
        notify("Connection restored.", "success");
        render();
        await syncOutbox({ quiet: true });
    }
});

window.addEventListener("offline", () => {
    if (state.view === "app") {
        notify("You're offline. Actions are being saved on this device.", "error");
        render();
    }
});

startApp();
