/**
 * In-memory session cache for sites, categories, and per-site devices.
 * Fetches only what is needed from Supabase (not the whole DB).
 */
const AppStore = (() => {
  const SITES_KEY = 'snm_sites_cache_v4';
  const CATEGORIES_KEY = 'snm_categories_cache_v1';
  let sites = null;
  let categories = null;
  let categoriesTableMissing = false;
  let devicesBySite = {};
  let loadingPromise = null;
  let categoriesLoading = null;

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

  function persistCategories() {
    try {
      if (categories) sessionStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    } catch (e) { /* ignore */ }
  }

  function restoreCategories() {
    try {
      const raw = sessionStorage.getItem(CATEGORIES_KEY);
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

    getCategories() {
      return categories || [];
    },

    isCategoriesTableMissing() {
      return categoriesTableMissing;
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

    /**
     * Load device categories from Supabase only (no hardcoded list).
     */
    async ensureCategories(forceRefresh = false) {
      if (!forceRefresh && categories !== null) return categories;

      if (!forceRefresh) {
        const cached = restoreCategories();
        if (cached) {
          // Ignore legacy offline/fallback cache entries (no id)
          const valid = cached.filter(c => c && c.id);
          if (valid.length === cached.length) {
            categories = valid;
            return categories;
          }
          sessionStorage.removeItem(CATEGORIES_KEY);
        }
      }

      if (categoriesLoading && !forceRefresh) return categoriesLoading;

      categoriesLoading = (async () => {
        try {
          categories = await getCategories();
          categoriesTableMissing = false;
        } catch (e) {
          console.warn('Categories load failed:', e.message);
          categories = [];
          categoriesTableMissing = e.code === 'DEVICE_TYPES_MISSING' ||
            /device_types is missing|schema cache/i.test(e.message || '');
        }
        persistCategories();
        return categories;
      })();

      try {
        return await categoriesLoading;
      } finally {
        categoriesLoading = null;
      }
    },

    async refresh() {
      devicesBySite = {};
      sites = await getSites();
      persistSites();
      await this.ensureCategories(true);
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

    setCategories(list) {
      categories = list || [];
      persistCategories();
    },

    upsertCategory(cat) {
      if (!categories) categories = [];
      const idx = categories.findIndex(c => c.id === cat.id);
      if (idx >= 0) categories[idx] = { ...categories[idx], ...cat };
      else categories.push(cat);
      categories.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
      persistCategories();
    },

    removeCategory(id) {
      if (!categories) return;
      categories = categories.filter(c => c.id !== id);
      persistCategories();
    },

    clear() {
      sites = null;
      categories = null;
      categoriesTableMissing = false;
      devicesBySite = {};
      sessionStorage.removeItem(SITES_KEY);
      sessionStorage.removeItem(CATEGORIES_KEY);
    }
  };
})();
