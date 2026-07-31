/**
 * In-memory session cache for sites + per-site devices.
 * Fetches only what is needed from Supabase (not the whole DB).
 */
const AppStore = (() => {
  const SITES_KEY = 'snm_sites_cache_v4';
  let sites = null;
  let devicesBySite = {};
  let loadingPromise = null;

  function persistSites() {
    try {
      if (sites) sessionStorage.setItem(SITES_KEY, JSON.stringify(sites));
    } catch (e) { /* ignore */ }
  }

  function restoreSites() {
    try {
      const raw = sessionStorage.getItem(SITES_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  return {
    getSites() {
      return sites || [];
    },

    getSite(id) {
      return (sites || []).find(s => s.id === id) || null;
    },

    getSiteDevices(siteId) {
      return devicesBySite[siteId] || [];
    },

    /**
     * Load site list (with counts). Uses session cache unless forced.
     */
    async ensureSites(forceRefresh = false) {
      if (!forceRefresh && sites) return sites;

      if (!forceRefresh) {
        const cached = restoreSites();
        if (cached) {
          sites = cached;
          return sites;
        }
      }

      if (loadingPromise && !forceRefresh) return loadingPromise;

      loadingPromise = (async () => {
        sites = await getSites();
        persistSites();
        return sites;
      })();

      try {
        return await loadingPromise;
      } finally {
        loadingPromise = null;
      }
    },

    async refresh() {
      devicesBySite = {};
      sites = await getSites();
      persistSites();
      return sites;
    },

    /**
     * Load devices for one site only
     */
    async ensureDevices(siteId, forceRefresh = false) {
      if (!forceRefresh && devicesBySite[siteId]) {
        return devicesBySite[siteId];
      }
      const list = await getDevices(siteId);
      devicesBySite[siteId] = list;
      const site = this.getSite(siteId);
      if (site) {
        site.deviceCount = list.length;
        site.devices = list;
        persistSites();
      }
      return list;
    },

    upsertSite(site) {
      if (!sites) sites = [];
      const idx = sites.findIndex(s => s.id === site.id);
      if (idx >= 0) sites[idx] = { ...sites[idx], ...site };
      else sites.unshift(site);
      persistSites();
    },

    removeSite(id) {
      if (!sites) return;
      sites = sites.filter(s => s.id !== id);
      delete devicesBySite[id];
      persistSites();
    },

    setSiteDevices(siteId, devices) {
      devicesBySite[siteId] = devices || [];
      const site = this.getSite(siteId);
      if (site) {
        site.devices = devicesBySite[siteId];
        site.deviceCount = devicesBySite[siteId].length;
        persistSites();
      }
    },

    clear() {
      sites = null;
      devicesBySite = {};
      sessionStorage.removeItem(SITES_KEY);
    }
  };
})();
