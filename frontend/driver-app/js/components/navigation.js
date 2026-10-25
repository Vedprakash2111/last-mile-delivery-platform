import { state, escapeHTML } from "../state.js";
import { brandMark } from "./brand.js";

export function topbar() {
    const name = state.identity?.full_name || "Driver";
    return `
        <header class="topbar">
            <a class="brand-lockup" href="#" data-action="go-home" aria-label="Last Mile Delivery Driver home">${brandMark("brand-symbol")}<span class="brand-wordmark"><strong>LAST MILE DELIVERY</strong><small>DRIVER APP</small></span></a>
            <div class="topbar-right">
                ${state.previewMode ? '<span class="preview-badge">LOCAL PREVIEW</span>' : ""}
                <button class="sync-indicator ${navigator.onLine ? "" : "is-offline"}" data-action="sync" title="Offline sync">
                    <span class="sync-dot"></span><span>${navigator.onLine ? "Online" : "Offline"}</span>${state.outboxCount ? `<b>${state.outboxCount}</b>` : ""}
                </button>
                <button class="avatar-button" data-tab="Profile" aria-label="Open profile">${escapeHTML(name.charAt(0).toUpperCase())}</button>
            </div>
        </header>`;
}

export function greeting() {
    const hour = new Date().getHours();
    const welcome = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    return `${welcome}, ${escapeHTML((state.identity?.full_name || "Driver").split(" ")[0])}.`;
}
