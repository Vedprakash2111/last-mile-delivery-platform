const TITLES = {
  overview: 'Overview',
  drivers: 'Drivers',
  users: 'Users',
  merchants: 'Merchants',
  warehouses: 'Warehouses',
  orders: 'Orders',
  activity: 'Activity'
};

export function parseRoute(hash = window.location.hash) {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const [path = '', query = ''] = raw.split('?', 2);
  const parts = path.split('/').filter(Boolean);
  const page = parts[0] || 'overview';
  return {
    page: Object.hasOwn(TITLES, page) ? page : 'overview',
    itemId: parts[1] || null,
    query: new URLSearchParams(query)
  };
}

export function pageTitle(page) {
  return TITLES[page] || TITLES.overview;
}

export function ensureDefaultRoute() {
  if (!window.location.hash) window.location.replace(`${window.location.pathname}${window.location.search}#/overview`);
}
