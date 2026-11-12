import { state, escapeHTML, formatCount } from "../state.js";

export function earningsView() {
    const delivered = state.completed.size;
    const totalStops = state.route?.stops.length || 0;
    const routeLabel = state.route?.title || "No active route";
    return `
        <section class="page-heading">
            <p class="eyebrow">DRIVER SUMMARY</p>
            <h1>Earnings</h1>
            <p>Delivery and payout information for your shift.</p>
        </section>
        <section class="earnings-card">
            <span class="earnings-card-icon">₹</span>
            <p class="eyebrow">PAYOUT SUMMARY</p>
            <h2>Not available yet</h2>
            <p>Your driver account does not currently provide earnings or payout data.</p>
            <span class="earnings-status">NO PAYOUT DATA CONNECTED</span>
        </section>
        <section class="wallet-breakdown" aria-label="Wallet earnings breakdown">
            <div class="section-heading"><div><p class="eyebrow">WALLET</p><h3>Balance breakdown</h3></div></div>
            <div class="wallet-balance"><span>Current balance</span><strong>Not available</strong></div>
            <div class="wallet-line-item"><span>Base pay</span><strong>Not provided</strong></div>
            <div class="wallet-line-item"><span>Customer tips</span><strong>Not provided</strong></div>
            <div class="wallet-line-item"><span>Surge / bonus</span><strong>Not provided</strong></div>
            <button class="button button-primary button-wide" type="button" disabled aria-disabled="true">Instant payout · unavailable</button>
            <p>Payout balances, earnings breakdowns, and payout transfers are not supported by the driver API.</p>
        </section>
        <section class="section-block earnings-activity">
            <div class="section-heading"><div><p class="eyebrow">DELIVERY ACTIVITY</p><h3>This shift</h3></div></div>
            <div class="earnings-metrics">
                <div><strong>${delivered}</strong><span>Delivered</span></div>
                <div><strong>${formatCount(totalStops, "stop")}</strong><span>Active route</span></div>
            </div>
            <p class="field-hint">${escapeHTML(routeLabel)} · Completed stops are shown for context; no earnings amount is inferred.</p>
        </section>
        <section class="activity-summary earnings-sync">
            <span class="activity-summary-icon">↻</span>
            <div><strong>${state.outboxCount ? `${state.outboxCount} item${state.outboxCount === 1 ? "" : "s"} waiting to sync` : "Activity is synced"}</strong><small>Driver events are stored locally before sync.</small></div>
            <button class="button button-secondary button-small" data-action="sync">Sync</button>
        </section>
        <button class="text-button earnings-activity-link" data-tab="Activity">View activity history <span>→</span></button>`;
}
