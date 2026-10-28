/* Reader reviews carousels (Subscribe page and gift page).
   The reviews themselves live in one place, /assets/reviews.json, and are
   drawn into every .reviews section on the page. Arrow buttons move one
   review at a time; on a phone, readers can also swipe. It never moves on
   its own, so nobody has to read against a timer. A section with no
   reviews stays hidden. */
(function () {
  var sections = document.querySelectorAll(".reviews");
  if (!sections.length || !window.fetch) return;

  var smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function card(review) {
    var li = document.createElement("li");
    li.className = "review";
    var tag = document.createElement("p");
    tag.className = "review-tag";
    tag.textContent = review.label;
    var quote = document.createElement("blockquote");
    var p = document.createElement("p");
    p.textContent = review.quote;
    quote.appendChild(p);
    var by = document.createElement("p");
    by.className = "review-by";
    by.textContent = review.name;
    if (review.place) {
      var place = document.createElement("span");
      place.textContent = review.place;
      by.appendChild(place);
    }
    li.appendChild(tag);
    li.appendChild(quote);
    li.appendChild(by);
    return li;
  }

  function setUp(section, reviews) {
    var track = section.querySelector(".reviews-track");
    var prev = section.querySelector('[data-dir="-1"]');
    var next = section.querySelector('[data-dir="1"]');
    reviews.forEach(function (review) { track.appendChild(card(review)); });
    section.hidden = false;

    function step() {
      var first = track.querySelector(".review");
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return first.getBoundingClientRect().width + gap;
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
  }

  fetch("/assets/reviews.json?v=20261028")
    .then(function (response) { return response.ok ? response.json() : []; })
    .then(function (reviews) {
      if (!reviews.length) return;
      sections.forEach(function (section) { setUp(section, reviews); });
    })
    .catch(function () { /* leave the sections hidden */ });
})();
