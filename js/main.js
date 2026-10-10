/* =====================================================================
   GTG RV Repair & Rentals — progressive enhancement
   The page is fully usable without this file. Each module is
   self-contained and guarded so later features can be added safely.
   ===================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

  /* --- Header: solid background once the page scrolls ------------- */
  function initHeader() {
    const header = document.querySelector('[data-header]');
    if (!header) return;
    const update = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  /* --- Mobile nav ---------------------------------------------------
     Upgrades the footer-anchor link into a disclosure button.
     While open: main + footer are inert, focus moves into the menu
     and Tab wraps between the menu and the toggle.                 */
  const mobileNav = { isOpen: () => false, close: () => {} };

  function initMobileNav() {
    const toggle = document.querySelector('[data-menu-toggle]');
    const nav = document.querySelector('[data-nav]');
    if (!toggle || !nav) return;

    const outside = [document.querySelector('main'), document.querySelector('footer')].filter(Boolean);
    const desktop = window.matchMedia('(min-width: 1140px)');

    toggle.setAttribute('role', 'button');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.removeAttribute('href');
    toggle.tabIndex = 0;

    const visibleFocusables = () =>
      [...nav.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);

    const setOpen = (open, { returnFocus = false } = {}) => {
      root.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      outside.forEach((el) => { el.inert = open; });
      if (open) {
        // The panel becomes visible after a style pass; retry briefly until focus lands
        let tries = 0;
        const focusFirst = () => {
          const first = visibleFocusables()[0];
          first?.focus();
          if (first && document.activeElement !== first && ++tries < 8) setTimeout(focusFirst, 40);
        };
        setTimeout(focusFirst, 30);
      } else if (returnFocus) {
        toggle.focus();
      }
    };

    mobileNav.isOpen = () => root.classList.contains('nav-open');
    mobileNav.close = () => setOpen(false);

    toggle.addEventListener('click', () => setOpen(!mobileNav.isOpen()));
    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle.click(); }
    });

    document.addEventListener('keydown', (e) => {
      if (!mobileNav.isOpen()) return;

      if (e.key === 'Escape') { setOpen(false, { returnFocus: true }); return; }

      if (e.key === 'Tab') {
        const cycle = [...visibleFocusables(), toggle];
        const first = cycle[0];
        const last = cycle[cycle.length - 1];
        const i = cycle.indexOf(document.activeElement);
        if (i === -1) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    nav.addEventListener('click', (e) => {
      if (e.target.closest('a')) setOpen(false);
    });

    desktop.addEventListener('change', (e) => { if (e.matches) setOpen(false); });
  }

  /* --- Submenus -----------------------------------------------------
     Button toggles .is-open (keyboard path). Hover opens via CSS;
     Escape dismisses either until the pointer/focus leaves.         */
  function initSubmenus() {
    document.querySelectorAll('[data-submenu]').forEach((item) => {
      const btn = item.querySelector('.sub-toggle');
      if (!btn) return;

      const close = () => {
        item.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
      };

      btn.addEventListener('click', () => {
        const open = !item.classList.contains('is-open');
        item.classList.toggle('is-open', open);
        item.classList.remove('is-dismissed');
        btn.setAttribute('aria-expanded', String(open));
      });

      item.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const wasOpen = item.classList.contains('is-open') || item.matches(':hover');
        if (!wasOpen) return;
        e.stopPropagation();
        close();
        item.classList.add('is-dismissed');
        btn.focus();
      });

      item.addEventListener('focusout', (e) => {
        if (!item.contains(e.relatedTarget)) {
          close();
          item.classList.remove('is-dismissed');
        }
      });

      item.addEventListener('mouseleave', () => item.classList.remove('is-dismissed'));

      document.addEventListener('click', (e) => { if (!item.contains(e.target)) close(); });
    });

    // Escape also dismisses a purely hover-opened menu when focus is elsewhere
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      document.querySelectorAll('[data-submenu]:hover').forEach((item) => item.classList.add('is-dismissed'));
    });
  }

  /* --- Booking bar ---------------------------------------------------- */
  function initBooking() {
    const form = document.querySelector('.booking');
    if (!form) return;

    // Sync intent onto the form (fallback for browsers without :has)
    const sync = () => {
      const checked = form.querySelector('input[name="intent"]:checked');
      form.dataset.intent = checked ? checked.value : 'rent';
    };
    form.querySelectorAll('input[name="intent"]').forEach((r) => r.addEventListener('change', sync));
    sync();

    // Links with data-tab-link pre-select the matching tab
    document.querySelectorAll('[data-tab-link]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const target = form.querySelector(`input[name="intent"][value="${link.dataset.tabLink}"]`);
        if (!target) return;
        e.preventDefault();
        if (mobileNav.isOpen()) mobileNav.close(); // un-inert main before focusing into it
        target.checked = true;
        sync();
        form.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
        target.focus({ preventScroll: true });
      });
    });

    // Dates: sensible defaults + friendly labels (“Fri, Oct 16”)
    const pickup = form.querySelector('#pickup');
    const ret = form.querySelector('#return');
    if (!pickup || !ret) return;

    const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const label = (input) => {
      const field = input.closest('.field--date');
      const display = field?.querySelector('.field__display');
      if (!display) return;
      if (input.value) {
        const [y, m, d] = input.value.split('-').map(Number);
        display.textContent = fmt.format(new Date(y, m - 1, d));
        field.classList.add('has-display');
      } else {
        field.classList.remove('has-display');
      }
    };

    if (!pickup.value) {
      const d = new Date();
      d.setDate(d.getDate() + ((((5 - d.getDay()) + 7) % 7) || 7)); // next Friday
      pickup.value = iso(d);
      const r = new Date(d); r.setDate(r.getDate() + 2);
      ret.value = iso(r);
    }
    pickup.min = iso(new Date());
    ret.min = pickup.value;

    pickup.addEventListener('change', () => {
      ret.min = pickup.value;
      if (ret.value < pickup.value) ret.value = pickup.value;
      label(pickup); label(ret);
    });
    ret.addEventListener('change', () => label(ret));
    label(pickup); label(ret);

    // Mockup only: prevent navigation to "#".
    form.addEventListener('submit', (e) => e.preventDefault());
  }

  /* --- Reveal-on-scroll + checklist trigger ------------------------- */
  function initReveal() {
    const items = document.querySelectorAll('[data-reveal]');
    const checklists = document.querySelectorAll('[data-checklist]');

    // Hero tag checks itself off on load
    document.querySelectorAll('[data-checklist-auto]').forEach((el) => el.classList.add('is-checked'));

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      checklists.forEach((el) => el.classList.add('is-checked'));
      return;
    }

    // Stagger siblings that share a parent (cards in a grid, etc.)
    const groups = new Map();
    items.forEach((el) => {
      const p = el.parentElement;
      const i = groups.get(p) || 0;
      el.style.setProperty('--reveal-delay', `${Math.min(i, 4) * 70}ms`);
      groups.set(p, i + 1);
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        if (entry.target.matches('[data-checklist]')) entry.target.classList.add('is-checked');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });

    items.forEach((el) => io.observe(el));
  }

  /* --- Footer year ------------------------------------------------- */
  function initYear() {
    document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  }

  const init = () => {
    initHeader();
    initMobileNav();
    initSubmenus();
    initBooking();
    initReveal();
    initYear();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
