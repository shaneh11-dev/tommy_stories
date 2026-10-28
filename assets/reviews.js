/* Reviews carousel on the Subscribe page.
   The arrow buttons move one review at a time; on a phone, readers can also swipe.
   It never moves on its own, so nobody has to read against a timer.
   If the list has no reviews in it, the whole section stays hidden. */
(function () {
  var section = document.querySelector(".reviews");
  if (!section) return;

  var track = section.querySelector(".reviews-track");
  var prev = section.querySelector('[data-dir="-1"]');
  var next = section.querySelector('[data-dir="1"]');

  if (!track.querySelector(".review")) {
    section.hidden = true;
    return;
  }

  var smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function step() {
    var card = track.querySelector(".review");
    var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return card.getBoundingClientRect().width + gap;
  }

  function update() {
    var max = track.scrollWidth - track.clientWidth - 2;
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max;
    section.classList.toggle("reviews--all-visible", max <= 0);
  }

  [prev, next].forEach(function (button) {
    button.addEventListener("click", function () {
      track.scrollBy({ left: step() * Number(button.dataset.dir), behavior: smooth ? "smooth" : "auto" });
    });
  });

  track.addEventListener("scroll", function () { window.requestAnimationFrame(update); }, { passive: true });
  window.addEventListener("resize", update);
  update();
})();
