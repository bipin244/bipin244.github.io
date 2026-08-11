/**
 * In-memory + session cache
 */
const AppStore = (() => {
  const KEY = 'inv_cache_v1';
  let clients = null;
  let entries = null;
  let profile = null;

  function persist() {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ clients, entries, profile }));
    } catch (e) { /* ignore */ }
  }

  function restore() {
    try {
      const raw = sessionStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  return {
    getClients() { return clients || []; },
    getClient(id) { return (clients || []).find(c => c.id === id) || null; },
    getEntries() { return entries || []; },
    getProfile() { return profile; },

    async ensureAll(force = false) {
      if (!force && clients && entries) {
        return { clients, entries, profile };
      }
      if (!force) {
        const cached = restore();
        if (cached?.clients && cached?.entries) {
          clients = cached.clients;
          entries = cached.entries;
          profile = cached.profile || null;
          return { clients, entries, profile };
        }
      }
      const [c, e, p] = await Promise.all([
        getClients(),
        getEntries(),
        getProfile().catch(() => null)
      ]);
      clients = c;
      entries = e;
      profile = p;
      persist();
      return { clients, entries, profile };
    },

    async refresh() {
      return this.ensureAll(true);
    },

    setClients(list) { clients = list || []; persist(); },
    upsertClient(client) {
      if (!clients) clients = [];
      const i = clients.findIndex(c => c.id === client.id);
      if (i >= 0) clients[i] = { ...clients[i], ...client };
      else clients.push(client);
      clients.sort((a, b) => a.name.localeCompare(b.name));
      persist();
    },
    removeClient(id) {
      clients = (clients || []).filter(c => c.id !== id);
      entries = (entries || []).filter(e => e.clientId !== id);
      persist();
    },
    setEntries(list) { entries = list || []; persist(); },
    upsertEntry(entry) {
      if (!entries) entries = [];
      const i = entries.findIndex(e => e.id === entry.id);
      if (i >= 0) entries[i] = { ...entries[i], ...entry };
      else entries.unshift(entry);
      entries.sort((a, b) => (b.workDate || '').localeCompare(a.workDate || '') ||
        (b.createdAt || '').localeCompare(a.createdAt || ''));
      persist();
    },
    removeEntry(id) {
      entries = (entries || []).filter(e => e.id !== id);
      persist();
    },
    setProfile(p) { profile = p; persist(); },
    clear() {
      clients = null;
      entries = null;
      profile = null;
      sessionStorage.removeItem(KEY);
    }
  };
})();
