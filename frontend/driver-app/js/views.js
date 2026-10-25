import { appRoot, state } from "./state.js";
import { loginScreen, registerScreen } from "./components/auth.js";
import { topbar } from "./components/navigation.js";
import { todayView } from "./components/dashboard.js";
import { routeOpportunitiesView, routeView } from "./components/routes.js";
import { deliveriesView } from "./components/deliveries.js";
import { activityView, loadActivity } from "./components/activity.js";
import { earningsView } from "./components/earnings.js";
import { profileView } from "./components/profile.js";

export function tabContent() {
    if (state.tab === "Today") return todayView();
    if (state.tab === "Routes") return routeOpportunitiesView();
    if (state.tab === "Route") return routeView();
    if (state.tab === "Deliveries") return deliveriesView();
    if (state.tab === "Earnings") return earningsView();
    if (state.tab === "Activity") return activityView();
    return profileView();
}

export function render() {
    if (!state.db) return;
    if (state.view === "login") {
        appRoot.innerHTML = loginScreen();
        return;
    }
    if (state.view === "register") {
        appRoot.innerHTML = registerScreen();
        return;
    }
    const tabs = [
        { id: "Today", label: "Home", icon: "⌂" },
        { id: "Routes", label: "Routes", icon: "↗" },
        { id: "Deliveries", label: "Deliveries", icon: "▤" },
        { id: "Profile", label: "Profile", icon: "○" }
    ];
    appRoot.innerHTML = `${topbar()}<main class="main-content">${tabContent()}</main>
        <nav class="bottom-nav" aria-label="Main navigation">${tabs.map((tab) => `
            <button class="nav-item ${state.tab === tab.id || (tab.id === "Routes" && state.tab === "Route") ? "is-active" : ""}" data-tab="${tab.id}" ${state.tab === tab.id || (tab.id === "Routes" && state.tab === "Route") ? 'aria-current="page"' : ""}>
                <span class="nav-icon">${tab.icon}</span><span>${tab.label}</span>
                ${tab.id === "Profile" && state.outboxCount ? `<i class="nav-badge"></i>` : ""}
            </button>`).join("")}
        </nav>`;
    if (state.tab === "Activity") loadActivity();
}
