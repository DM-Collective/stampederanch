/* The Stampede Ranch — front-end behaviour
   Vanilla JS, no dependencies. Everything here degrades gracefully. */
(function () {
  'use strict';

  /* ---------------------------------------------------------------
     Off-canvas menu (shared by the desktop rail + the mobile topbar)
     --------------------------------------------------------------- */
  var menu = document.getElementById('menu');
  var toggles = Array.prototype.slice.call(document.querySelectorAll('[data-menu-toggle]'));

  function setMenu(open) {
    if (!menu) return;
    menu.setAttribute('data-open', open ? 'true' : 'false');
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    toggles.forEach(function (t) { t.setAttribute('aria-expanded', open ? 'true' : 'false'); });
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      // Defer: the browser focuses the clicked button after the click handler,
      // which would steal focus straight back out of the menu.
      setTimeout(function () {
        var first = menu.querySelector('a');
        if (first) first.focus();
      }, 0);
    }
  }

  toggles.forEach(function (t) {
    t.addEventListener('click', function () {
      setMenu(menu.getAttribute('data-open') !== 'true');
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu && menu.getAttribute('data-open') === 'true') {
      setMenu(false);
      if (toggles[0]) toggles[0].focus();
    }
  });

  if (menu) {
    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') setMenu(false);
    });
  }

  /* ---------------------------------------------------------------
     Scroll reveal
     --------------------------------------------------------------- */
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var revealables = document.querySelectorAll('[data-reveal]');

  if (reduced || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(revealables, function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = parseInt(el.getAttribute('data-reveal-delay') || '0', 10);
        setTimeout(function () { el.classList.add('is-visible'); }, delay);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    Array.prototype.forEach.call(revealables, function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------
     Hero video: honour reduced motion, expose a play/pause control
     --------------------------------------------------------------- */
  var video = document.querySelector('[data-hero-video]');
  var vToggle = document.querySelector('[data-video-toggle]');

  if (video) {
    // Upgrade to the larger cut only where it earns its bytes: a wide viewport,
    // no data-saver, and no 2g/3g connection.
    var conn = navigator.connection || {};
    var wide = window.matchMedia('(min-width: 1100px)').matches;
    var thrifty = conn.saveData === true || /^(slow-)?2g$|^3g$/.test(conn.effectiveType || '');
    if (wide && !thrifty && !reduced) {
      var swapped = false;
      Array.prototype.forEach.call(video.querySelectorAll('[data-hero-source]'), function (s) {
        var large = s.getAttribute('data-large');
        if (large && s.getAttribute('src') !== large) { s.setAttribute('src', large); swapped = true; }
      });
      if (swapped) video.load();
    }

    if (reduced) {
      video.removeAttribute('autoplay');
      video.pause();
    } else {
      // Autoplay can still be refused (low power mode, strict policies);
      // fall back to the poster and let the control offer playback.
      var attempt = video.play();
      if (attempt && typeof attempt.catch === 'function') { attempt.catch(function () {}); }
    }
    if (vToggle) {
      var label = vToggle.querySelector('span');
      var sync = function () {
        var paused = video.paused;
        if (label) label.textContent = paused ? 'Play film' : 'Pause film';
        vToggle.setAttribute('aria-pressed', paused ? 'false' : 'true');
      };
      vToggle.addEventListener('click', function () {
        if (video.paused) { video.play(); } else { video.pause(); }
        sync();
      });
      video.addEventListener('play', sync);
      video.addEventListener('pause', sync);
      sync();
    }
  }

  /* ---------------------------------------------------------------
     Inquiry forms — prototype only.
     In the WordPress build these post to Gravity Forms / WS Form and
     on into the CRM. Here we intercept and confirm inline so the
     flow can be reviewed end to end.
     --------------------------------------------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-demo-form]'), function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var status = form.querySelector('[data-form-status]');
      if (status) {
        status.hidden = false;
        status.textContent =
          'Thank you — your inquiry has been received. A member of the ranch team will be in touch within one business day. (Prototype: no data was sent.)';
        status.focus();
      }
      form.reset();
    });
  });

  /* ---------------------------------------------------------------
     Terms sheet — opened from the booking form's consent checkbox.
     The trigger is a real link to terms.html, so with JS off (or if
     this fails) the terms are still reachable as a page.
     --------------------------------------------------------------- */
  var sheet = document.getElementById('terms-sheet');

  if (sheet) {
    var panel = sheet.querySelector('.sheet__panel');
    var sheetReturn = null;
    var FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

    var sheetOpen = function () { return sheet.getAttribute('data-open') === 'true'; };

    var setSheet = function (open) {
      sheet.setAttribute('data-open', open ? 'true' : 'false');
      sheet.setAttribute('aria-hidden', open ? 'false' : 'true');
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) {
        sheetReturn = document.activeElement;
        if (panel) { panel.scrollTop = 0; panel.focus(); }
        var body = sheet.querySelector('.sheet__body');
        if (body) body.scrollTop = 0;
      } else if (sheetReturn && sheetReturn.focus) {
        sheetReturn.focus();
        sheetReturn = null;
      }
    };

    Array.prototype.forEach.call(document.querySelectorAll('[data-terms-open]'), function (link) {
      link.addEventListener('click', function (e) {
        // Stop the label from toggling the checkbox on the way through.
        e.preventDefault();
        e.stopPropagation();
        setSheet(true);
      });
    });

    Array.prototype.forEach.call(sheet.querySelectorAll('[data-sheet-close]'), function (b) {
      b.addEventListener('click', function () { setSheet(false); });
    });

    // Click the backdrop, not the panel.
    sheet.addEventListener('click', function (e) {
      if (e.target === sheet) setSheet(false);
    });

    var accept = sheet.querySelector('[data-sheet-accept]');
    if (accept) {
      accept.addEventListener('click', function () {
        var box = document.getElementById('v-terms');
        if (box) {
          box.checked = true;
          if (typeof Event === 'function') { box.dispatchEvent(new Event('change', { bubbles: true })); }
          sheetReturn = box;
        }
        setSheet(false);
      });
    }

    document.addEventListener('keydown', function (e) {
      if (!sheetOpen()) return;
      if (e.key === 'Escape') { setSheet(false); return; }
      if (e.key !== 'Tab') return;
      var items = Array.prototype.slice.call(sheet.querySelectorAll(FOCUSABLE))
        .filter(function (el) { return el.offsetParent !== null; });
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });
  }

  /* ---------------------------------------------------------------
     Current year in footers
     --------------------------------------------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-year]'), function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
