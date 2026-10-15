import { requestJson, postJson, patchJson, ApiError } from './api.js';
import { ensureDefaultRoute, parseRoute, pageTitle } from './router.js';
import { createOverviewPage } from './pages/overview.js';
import { createDriversPage } from './pages/drivers.js';
import { createUsersPage } from './pages/users.js';
import { createMerchantsPage } from './pages/merchants.js';

const shell = document.getElementById('admin-shell');
const accessDenied = document.getElementById('access-denied');
const bootstrapError = document.getElementById('bootstrap-error');
const bootstrapMessage = document.getElementById('bootstrap-message');
const pageContent = document.getElementById('page-content');
const pageTitleNode = document.getElementById('page-title');
const lastRefreshedNode = document.getElementById('last-refreshed');
const refreshButton = document.getElementById('refresh-button');
const logoutButton = document.getElementById('logout-button');
const toastRegion = document.getElementById('toast-region');

let activePage = null;
let toastTimer = null;
let startupBusy = false;

const api = {
  get: (path, options) => requestJson(path, options),
  post: (path, body) => postJson(path, body),
  patch: (path, body) => patchJson(path, body)
};

function setStartupError(message) {
  bootstrapMessage.textContent = message;
  bootstrapError.hidden = false;
  shell.hidden = true;
  accessDenied.hidden = true;
}

function setAccessDenied() {
  accessDenied.hidden = false;
  shell.hidden = true;
  bootstrapError.hidden = true;
}

function showToast(message, tone = 'success') {
  toastRegion.replaceChildren();
  const toast = document.createElement('div');
  toast.className = `toast${tone === 'error' ? ' error' : ''}`;
  toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  toast.textContent = message;
  toastRegion.append(toast);
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.remove(), 4600);
}

function setRefreshed(at) {
  if (!(at instanceof Date) || Number.isNaN(at.getTime())) return;
  const formatted = new Intl.DateTimeFormat(undefined, {
    timeZone: window.adminTimezone || 'Asia/Kolkata', hour: 'numeric', minute: '2-digit'
  }).format(at);
  lastRefreshedNode.textContent = `Last refreshed ${formatted}`;
  lastRefreshedNode.title = `Browser fetch completed at ${at.toISOString()}`;
}

function updateNav(page) {
  document.querySelectorAll('#primary-nav [data-route]').forEach((link) => {
    if (link.dataset.route === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function renderPlaceholder(page) {
  const section = document.createElement('section');
  section.className = 'page-placeholder';
  const content = document.createElement('div');
  const mark = document.createElement('div');
  mark.className = 'placeholder-mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 5h14v14H5zM8 9h8M8 12h8M8 15h5"/></svg>';
  const title = document.createElement('h2');
  title.textContent = `${pageTitle(page)} workspace`;
  const copy = document.createElement('p');
  copy.textContent = 'This section is scheduled for a later implementation step. The Overview is available now.';
  const link = document.createElement('a');
  link.className = 'button button-primary';
  link.href = '#/overview';
  link.textContent = 'Return to overview';
  content.append(mark, title, copy, link);
  section.append(content);
  return section;
}

function renderRoute() {
  if (shell.hidden) return;
  activePage?.destroy?.();
  activePage = null;
  const route = parseRoute();
  const title = pageTitle(route.page);
  pageTitleNode.textContent = title;
  updateNav(route.page);
  refreshButton.hidden = route.page !== 'overview';
  lastRefreshedNode.hidden = route.page !== 'overview';
  pageContent.replaceChildren();
  pageContent.setAttribute('aria-busy', 'false');

  if (route.page === 'overview') {
    activePage = createOverviewPage({
      api, timezone: window.adminTimezone || 'Asia/Kolkata', onToast: showToast,
      onPageTitle: (value) => { pageTitleNode.textContent = value; }
    });
    pageContent.append(activePage.element);
  } else if (route.page === 'drivers') {
    activePage = createDriversPage({ api, onToast: showToast, route });
    pageContent.append(activePage.element);
  } else if (route.page === 'users') {
    activePage = createUsersPage({ api, onToast: showToast, route });
    pageContent.append(activePage.element);
  } else if (route.page === 'merchants') {
    activePage = createMerchantsPage({ api, onToast: showToast, route });
    pageContent.append(activePage.element);
  } else {
    pageContent.append(renderPlaceholder(route.page));
  }
}

async function startWorkspace() {
  if (startupBusy) return;
  startupBusy = true;
  bootstrapError.hidden = true;
  try {
    const me = await api.get('/api/admin/me');
    if (!Array.isArray(me.roles) || !me.roles.includes('admin')) {
      setAccessDenied();
      return;
    }
    window.adminTimezone = typeof me.app_timezone === 'string' && me.app_timezone ? me.app_timezone : 'Asia/Kolkata';
    document.getElementById('account-name').textContent = me.full_name || 'Administrator';
    document.getElementById('account-email').textContent = me.email || 'No email on account';
    document.getElementById('account-avatar').textContent = (me.full_name || 'A').trim().charAt(0).toUpperCase();
    shell.hidden = false;
    ensureDefaultRoute();
    renderRoute();
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      setAccessDenied();
    } else if (!(error instanceof ApiError && error.status === 401)) {
      setStartupError(error.message || 'We couldn’t load your account. Try again.');
    }
  } finally {
    startupBusy = false;
  }
}

window.addEventListener('hashchange', renderRoute);
window.addEventListener('admin:data-refreshed', (event) => setRefreshed(event.detail?.at));
document.getElementById('bootstrap-retry').addEventListener('click', startWorkspace);
refreshButton.addEventListener('click', () => {
  if (!activePage?.refresh) return;
  refreshButton.disabled = true;
  refreshButton.classList.add('is-loading');
  activePage.refresh().finally(() => {
    refreshButton.disabled = false;
    refreshButton.classList.remove('is-loading');
  });
});
logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try {
    const response = await fetch('/auth/logout', {
      method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error('Sign out could not be completed. Please try again.');
    window.location.assign('/login');
  } catch (error) {
    logoutButton.disabled = false;
    showToast(error.message || 'Unable to sign out. Check your connection and retry.', 'error');
  }
});

startWorkspace();
