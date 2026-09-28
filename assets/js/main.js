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
     Turnstile setup.
     TURNSTILE_SITE_KEY is the real widget key (Managed mode, widget
     "Stampede Ranch website", hostnames stampederanch.ca /
     www.stampederanch.ca), added 2026-09-22. Site keys are meant to be
     public (they're not secrets), so hardcoding it here is the normal,
     correct approach for a static site with no server-side templating.
     The matching secret key lives only in Vercel as TURNSTILE_SECRET_KEY
     (production), read server-side in /api/send-email.js -- never here.
     Rendered explicitly (not via Turnstile's auto-render scan) so we
     control exactly when each widget appears and can reset it after
     each submission; explicit render also still auto-injects a hidden
     "cf-turnstile-response" input inside each container, so the existing
     FormData-based form handler below picks up the token with no other
     changes needed.
     --------------------------------------------------------------- */
  var TURNSTILE_SITE_KEY = '0x4AAAAAAFHKOe8k9oqniyZb';
  var turnstileWidgetIds = new WeakMap(); // form -> widgetId, for reset()

  // Turnstile's api.js loads with `async`, so it can finish (and try to
  // fire its onload callback) before this deferred script has even run --
  // there's no guaranteed ordering between an async script and a deferred
  // one. A tiny inline stub in <head> (see every page's <head>) defines
  // window.onTurnstileLoad synchronously during HTML parsing, before any
  // async/deferred script can execute, and sets a ready flag if Turnstile
  // calls it first. Here we do the actual rendering work, and check that
  // flag in case we're the one arriving second.
  window.__turnstileRenderAll = function () {
    // Defensive no-op now that the real site key is in place above; kept
    // so that reverting to a placeholder (e.g. on a dev branch) fails
    // safe by simply not rendering, rather than showing Cloudflare's
    // visible "invalid sitekey" error box to a real visitor.
    if (TURNSTILE_SITE_KEY.indexOf('REPLACE_WITH') === 0) return;
    Array.prototype.forEach.call(document.querySelectorAll('.cf-turnstile'), function (container) {
      var form = container.closest('form');
      if (!form || typeof window.turnstile === 'undefined') return;
      var widgetId = window.turnstile.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'light',
        size: 'compact'
      });
      turnstileWidgetIds.set(form, widgetId);
    });
  };
  if (window.__turnstileApiReady) { window.__turnstileRenderAll(); }

  /* ---------------------------------------------------------------
     Inquiry forms — live, backed by /api/send-email (Resend), fronted
     by Turnstile + a honeypot + a submission-timing check, all verified
     server-side (see /api/send-email.js -- nothing here is trusted on
     its own).
     Every [data-demo-form] posts its fields as JSON to the serverless
     function. data-form-type on each form ("contact" | "venues" |
     "weddings" | "newsletter") tells the function which kind of
     submission it is, for the subject line and email formatting; it
     does not change what's sent otherwise.
     The "-demo-form" attribute name is legacy from the prototype phase
     and is kept only so no HTML needs to change beyond adding
     data-form-type; it no longer means the form is a demo.
     --------------------------------------------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-demo-form]'), function (form) {
    // Stamp a render timestamp the moment each form is wired up, so the
    // server can sanity-check "how long between page load and submit"
    // without penalizing password managers (which still take a beat
    // before the user clicks submit) -- see the threshold server-side.
    var tsField = form.querySelector('[data-form-ts]');
    if (tsField) tsField.value = String(Date.now());

    // Reads the current cf-turnstile-response value straight from the DOM
    // (not a stale FormData snapshot), so callers can poll it.
    function readTurnstileToken() {
      var input = form.querySelector('input[name="cf-turnstile-response"]');
      return input ? input.value : '';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var status = form.querySelector('[data-form-status]') ||
        (form.parentElement && form.parentElement.querySelector('[data-form-status]'));
      var submitBtn = form.querySelector('button[type="submit"]');
      var formType = form.getAttribute('data-form-type') || 'contact';
      var originalBtnText = submitBtn ? submitBtn.textContent : '';

      function resetTurnstile() {
        var widgetId = turnstileWidgetIds.get(form);
        if (widgetId !== undefined && window.turnstile) {
          window.turnstile.reset(widgetId);
        }
      }

      function showError(message) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
        resetTurnstile();
        if (status) {
          status.hidden = false;
          status.textContent = message;
          status.focus();
        }
      }

      if (submitBtn) { submitBtn.disabled = true; }

      function doSend() {
        var fields = {};
        var turnstileToken = readTurnstileToken();
        var honeypotValue = '';
        var formData = new FormData(form);
        formData.forEach(function (value, key) {
          if (key === 'cf-turnstile-response') { return; } // read fresh above instead
          if (key === 'website') { honeypotValue = value; return; }
          if (key === '_ts') { return; } // sent separately as submittedAt
          // Checkboxes (e.g. the terms checkbox) submit "on"; report a plain
          // yes rather than the raw browser value.
          fields[key] = value === 'on' ? 'Yes' : value;
        });

        if (submitBtn) { submitBtn.textContent = 'Sending…'; }
        if (status) {
          status.hidden = false;
          status.textContent = 'Sending your request…';
        }

        fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formType: formType,
          fields: fields,
          pageUrl: window.location.href,
          turnstileToken: turnstileToken,
          website: honeypotValue,
          submittedAt: tsField ? tsField.value : ''
        })
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            return { httpOk: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
          }
          if (result.data && result.data.ok) {
            if (status) {
              status.textContent = formType === 'newsletter'
                ? 'Thanks for joining — you\u2019re on the list.'
                : 'Thank you — your inquiry has been received. A member of the ranch team will be in touch within one business day.';
              status.focus();
            }
            form.reset();
            resetTurnstile();
            return;
          }
          if (result.data && result.data.code === 'verification_failed') {
            showError('We couldn\u2019t verify your submission. Please try again.');
            return;
          }
          showError('Something went wrong sending your request. Please try again, or email us directly at info@stampederanch.ca.');
        })
        .catch(function () {
          showError('Something went wrong sending your request. Please try again, or email us directly at info@stampederanch.ca.');
        });
      }

      // Turnstile's managed check usually completes near-instantly, but on
      // a very fast submission (or a slow network to Cloudflare) the token
      // may not exist yet the moment the user clicks submit. Rather than
      // sending an empty token and failing with a confusing "couldn't
      // verify" message, wait briefly for it to appear.
      if (readTurnstileToken()) {
        doSend();
      } else if (typeof window.turnstile === 'undefined') {
        // Turnstile never loaded at all (blocked, offline, script error) --
        // sending anyway lets the server give its normal, honest
        // verification_failed response rather than hanging here forever.
        doSend();
      } else {
        if (status) {
          status.hidden = false;
          status.textContent = 'Verifying your browser, one moment…';
        }
        var waited = 0;
        var pollMs = 200;
        var maxWaitMs = 3000;
        var poll = setInterval(function () {
          waited += pollMs;
          if (readTurnstileToken()) {
            clearInterval(poll);
            doSend();
          } else if (waited >= maxWaitMs) {
            clearInterval(poll);
            doSend(); // let the server give its normal verification_failed response
          }
        }, pollMs);
      }
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
