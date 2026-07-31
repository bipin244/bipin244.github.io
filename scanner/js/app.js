/**
 * SPA router — Supabase session once; hash views without full reload.
 * Routes: #/  #/site/:id  #/settings
 */

const App = {
  currentUser: null,
  bound: false,

  async start() {
    applyTheme(getTheme());
    this.bindChrome();

    try {
      this.currentUser = await requireAuth();
    } catch (e) {
      return;
    }

    setLoading(true);
    try {
      await AppStore.ensureSites();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to load data. Check Supabase config & RLS.', 'error');
    } finally {
      setLoading(false);
    }

    window.addEventListener('hashchange', () => this.route());
    this.route();
  },

  bindChrome() {
    if (this.bound) return;
    this.bound = true;

    $(document).on('click', '.btn-logout', () => logout());

    $(document).on('click', '.btn-theme', () => {
      const t = toggleTheme();
      $('.btn-theme i').attr('class', t === 'dark' ? 'bi bi-sun' : 'bi bi-moon');
      $('#theme-switch').prop('checked', t === 'dark');
      document.querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', t === 'dark' ? '#0f1615' : '#0f766e');
    });

    $('.btn-theme i').attr('class', getTheme() === 'dark' ? 'bi bi-sun' : 'bi bi-moon');
    if (getTheme() === 'dark') {
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0f1615');
    }

    $(document).on('click', '.btn-refresh-sites', async () => {
      setLoading(true);
      try {
        await AppStore.refresh();
        showToast('Data refreshed');
        if (location.hash.replace(/^#/, '').startsWith('/site/')) {
          await SiteView.refresh();
        } else {
          DashboardView.render();
        }
      } catch (err) {
        console.error(err);
        showToast(err.message || 'Refresh failed', 'error');
      } finally {
        setLoading(false);
      }
    });

    DashboardView.bind();
    SiteView.bind();
    SettingsView.bind();
  },

  parseRoute() {
    let hash = location.hash.replace(/^#/, '') || '/';
    if (!hash.startsWith('/')) hash = '/' + hash;

    if (hash === '/' || hash === '') return { name: 'dashboard' };
    if (hash === '/settings') return { name: 'settings' };

    const siteMatch = hash.match(/^\/site\/([^/?]+)/);
    if (siteMatch) return { name: 'site', id: decodeURIComponent(siteMatch[1]) };

    return { name: 'dashboard' };
  },

  show(viewId) {
    $('.app-view').addClass('d-none').removeClass('is-site');
    $(viewId).removeClass('d-none');
    if (viewId === '#view-site') $(viewId).addClass('is-site');
    window.scrollTo(0, 0);
  },

  setNav(active) {
    $('#bottom-nav a').removeClass('active');
    if (active === 'sites') $('.nav-sites').addClass('active');
    if (active === 'settings') $('.nav-settings').addClass('active');
  },

  async route() {
    if (typeof Scanner !== 'undefined' && Scanner.isScanning()) {
      await Scanner.stop();
    }

    const route = this.parseRoute();

    if (route.name === 'dashboard') {
      document.title = 'Sites — Serial Number Manager';
      this.show('#view-dashboard');
      this.setNav('sites');
      DashboardView.render();
      return;
    }

    if (route.name === 'settings') {
      document.title = 'Settings — Serial Number Manager';
      this.show('#view-settings');
      this.setNav('settings');
      SettingsView.show(this.currentUser);
      return;
    }

    if (route.name === 'site') {
      document.title = 'Site — Serial Number Manager';
      this.show('#view-site');
      this.setNav('sites');
      await SiteView.show(route.id);
    }
  },

  go(path) {
    location.hash = path;
  }
};

$(() => App.start());
