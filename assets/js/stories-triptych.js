/* "Stories From the Ranch" film triptych -- click-to-play behaviour.
   Self-contained and additive: safe to include on any page, since it does
   nothing unless [data-film-triptych] exists on that page.

   Behaviour: each film shows its poster with a small play control. On
   click, playback starts inline with native controls and audio; any other
   film currently playing is paused. No autoplay, no autoplay-with-sound,
   nothing starts until the visitor chooses it. */
(function () {
  'use strict';

  var root = document.querySelector('[data-film-triptych]');
  if (!root) return;

  var plates = Array.prototype.slice.call(root.querySelectorAll('[data-film-plate]'));
  var videos = plates.map(function (p) { return p.querySelector('[data-film-video]'); });

  plates.forEach(function (plate, i) {
    var video = videos[i];
    var playBtn = plate.querySelector('[data-film-play]');
    if (!video || !playBtn) return;

    function start() {
      videos.forEach(function (v, j) {
        if (v !== video && !v.paused) v.pause();
      });
      video.setAttribute('controls', '');
      video.play();
      playBtn.classList.add('is-hidden');
    }

    playBtn.addEventListener('click', start);

    // If a visitor uses the native controls to pause/replay after already
    // starting once, keep our overlay out of the way permanently -- once
    // a film has been played, the native controls remain the interface.
    video.addEventListener('play', function () {
      playBtn.classList.add('is-hidden');
      videos.forEach(function (v, j) {
        if (v !== video && !v.paused) v.pause();
      });
    });
  });
})();
