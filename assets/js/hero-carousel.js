/* Hero image carousel -- used only on index-hero-c.html.
   Kept entirely separate from assets/js/main.js (shared by every other
   page, including the original video-hero homepage) so that page-specific
   fixed here can never affect the original homepage or any other page.

   Behaviour: autoplay every 6s, crossfade via opacity transition (see
   .hero-carousel__slide in main.css), prev/next buttons, dot indicators.
   Respects prefers-reduced-motion: autoplay is disabled and slide changes
   are instant (no crossfade) rather than animated. Manual navigation via
   the buttons/dots still works either way. */
(function () {
  'use strict';

  var root = document.querySelector('[data-hero-carousel]');
  if (!root) return;

  var slides = Array.prototype.slice.call(root.querySelectorAll('[data-hero-slide]'));
  var dots = Array.prototype.slice.call(document.querySelectorAll('[data-hero-dot]'));
  var prevBtn = document.querySelector('[data-hero-prev]');
  var nextBtn = document.querySelector('[data-hero-next]');
  if (!slides.length) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var current = slides.findIndex(function (s) { return s.classList.contains('is-active'); });
  if (current < 0) current = 0;
  var timer = null;
  var AUTOPLAY_MS = 6000;

  if (reduced) {
    // No crossfade animation under reduced motion -- instant swap only.
    slides.forEach(function (s) { s.style.transition = 'none'; });
  }

  function goTo(index) {
    var next = ((index % slides.length) + slides.length) % slides.length;
    if (next === current) return;
    slides[current].classList.remove('is-active');
    slides[current].setAttribute('aria-hidden', 'true');
    dots[current] && dots[current].classList.remove('is-active');
    dots[current] && dots[current].setAttribute('aria-selected', 'false');

    slides[next].classList.add('is-active');
    slides[next].setAttribute('aria-hidden', 'false');
    dots[next] && dots[next].classList.add('is-active');
    dots[next] && dots[next].setAttribute('aria-selected', 'true');

    current = next;
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  function startAutoplay() {
    if (reduced) return; // Respect reduced motion: no automatic rotation.
    stopAutoplay();
    timer = setInterval(next, AUTOPLAY_MS);
  }
  function stopAutoplay() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  if (prevBtn) prevBtn.addEventListener('click', function () { prev(); startAutoplay(); });
  if (nextBtn) nextBtn.addEventListener('click', function () { next(); startAutoplay(); });
  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () { goTo(i); startAutoplay(); });
  });

  // Pause on hover/focus so a visitor reading the hero copy doesn't fight
  // a slide change mid-read; resume on leave.
  var hero = document.querySelector('.hero');
  if (hero) {
    hero.addEventListener('mouseenter', stopAutoplay);
    hero.addEventListener('mouseleave', startAutoplay);
    hero.addEventListener('focusin', stopAutoplay);
    hero.addEventListener('focusout', startAutoplay);
  }

  startAutoplay();
})();
