// Home page, phones: once the reader scrolls past the buttons at the top, a
// small bar with "Subscribe" and "Give a gift" stays at the bottom of the
// screen. It steps aside while the plans ("Choose your subscription") or the
// footer are on screen, since those have their own links. Tablets and
// computers never show it (styles.css).
(function () {
  var bar = document.querySelector("[data-sticky-cta]");
  var start = document.querySelector(".hero .actions");
  if (!bar || !start || !("IntersectionObserver" in window)) return;

  var pastStart = false;
  var stops = [];

  function update() {
    var stopOnScreen = stops.some(function (stop) { return stop.onScreen; });
    bar.classList.toggle("is-shown", pastStart && !stopOnScreen);
  }

  new IntersectionObserver(function (entries) {
    var entry = entries[entries.length - 1];
    pastStart = !entry.isIntersecting && entry.boundingClientRect.top < 0;
    update();
  }).observe(start);

  // The plans count once they reach the top two thirds of the screen (so the
  // bar doesn't vanish the moment their edge peeks in); the footer counts as
  // soon as it appears, so the bar never covers its links.
  [["#subscribe", "0px 0px -33% 0px"], [".site-footer", "0px"]].forEach(function (pair) {
    var el = document.querySelector(pair[0]);
    if (!el) return;
    var stop = { onScreen: false };
    stops.push(stop);
    new IntersectionObserver(function (entries) {
      stop.onScreen = entries[entries.length - 1].isIntersecting;
      update();
    }, { rootMargin: pair[1] }).observe(el);
  });

  bar.classList.add("is-ready");
})();
