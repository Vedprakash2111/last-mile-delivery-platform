import { state, escapeHTML } from "../state.js";
import { brandMark } from "./brand.js";

export function loginScreen() {
    return `
        <main class="auth-layout">
            <section class="auth-brand">
                ${brandMark()}
                <p class="eyebrow">LAST MILE DELIVERY / DRIVER</p>
                <h1>Every mile,<br>delivered.</h1>
                <p class="brand-copy">Routes, handoffs, and proof of delivery — together in one field-ready place.</p>
                <div class="brand-route" aria-hidden="true"><span></span><span></span><span></span><i></i></div>
            </section>
            <section class="auth-card">
                <div class="auth-heading">
                    <p class="eyebrow">DRIVER PORTAL</p>
                    <h2>Welcome back</h2>
                    <p>Sign in to check your route and get moving.</p>
                </div>
                <div id="screen-error" class="form-error" role="alert" ${state.loginMessage ? "" : "hidden"}>${escapeHTML(state.loginMessage)}</div>
                <form id="login-form" class="form-stack">
                    <label>Email or phone
                        <input name="identifier" autocomplete="username" placeholder="you@example.com" required>
                    </label>
                    <label>Password
                        <input name="password" type="password" autocomplete="current-password" placeholder="Your password" required>
                    </label>
                    <button class="button button-primary button-wide" type="submit">Sign in <span>→</span></button>
                </form>
                <div class="auth-divider"><span>NEW TO THE FLEET?</span></div>
                <button class="button button-secondary button-wide" data-action="show-register">Create a driver account</button>
                ${["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
                    ? `<button class="button button-secondary button-wide" data-action="enter-local-preview">Open local preview (synthetic data)</button>`
                    : ""}
                <details class="api-settings">
                    <summary>Connection settings</summary>
                    <label>Driver Gateway URL
                        <input id="driver-gateway-url" type="url" value="${escapeHTML(state.settings.driverGatewayBase || window.location.origin)}" placeholder="https://driver-gateway.example.com">
                    </label>
                    <button class="button button-secondary button-small" data-action="save-gateway-url">Save API URL</button>
                </details>
            </section>
            <footer class="auth-footer">Made for the miles that matter <span>© 2026 LAST MILE DELIVERY</span></footer>
        </main>`;
}

export function registerScreen() {
    return `
        <main class="auth-layout register-layout">
            <section class="auth-brand">
                ${brandMark()}
                <p class="eyebrow">LAST MILE DELIVERY / DRIVER</p>
                <h1>Every great route<br>starts here.</h1>
                <p class="brand-copy">Create your driver account to join the delivery team.</p>
                <div class="brand-route" aria-hidden="true"><span></span><span></span><span></span><i></i></div>
            </section>
            <section class="auth-card">
                <button class="back-link" data-action="show-login">← Back to sign in</button>
                <div class="auth-heading">
                    <p class="eyebrow">JOIN THE FLEET</p>
                    <h2>Create account</h2>
                    <p>Your details are used to set up your driver profile.</p>
                </div>
                <div id="screen-error" class="form-error" role="alert" hidden></div>
                <form id="register-form" class="form-stack">
                    <label>Full name
                        <input name="full_name" autocomplete="name" placeholder="Your name" required>
                    </label>
                    <label>Email
                        <input name="email" type="email" autocomplete="email" placeholder="you@example.com" required>
                    </label>
                    <label>Phone <span class="label-hint">optional · include country code</span>
                        <input name="phone" type="tel" autocomplete="tel" placeholder="+919876543210">
                    </label>
                    <label>Password
                        <input name="password" type="password" autocomplete="new-password" minlength="8" placeholder="At least 8 characters" required>
                    </label>
                    <button class="button button-primary button-wide" type="submit">Create driver account <span>→</span></button>
                </form>
            </section>
            <footer class="auth-footer">Made for the miles that matter <span>© 2026 LAST MILE DELIVERY</span></footer>
        </main>`;
}
