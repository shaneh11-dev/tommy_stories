// Story pages for Facebook posts (stories/<slug>/, built by
// tools/build_stories.py):
// - "Copy the link" copies the story's address.
// - Tells Google Analytics when a reader reaches the end of the story
//   ("story_finished", with the story's name), so each story's read-through
//   can be compared.
// - Phones: once the reader is into the story, a small bar with Subscribe
//   and Give a gift stays at the bottom of the screen. It steps aside while
//   the offer under the story or the footer is on screen.
(function () {
  var slug = document.body.getAttribute("data-story") || "";

  // Copy the link.
  var copyButton = document.querySelector("[data-copy-link]");
  var status = document.querySelector(".story-share-status");
  if (copyButton) {
    copyButton.addEventListener("click", function () {
      var link = copyButton.getAttribute("data-copy-link");
      var done = function () { if (status) status.textContent = "Link copied. Paste it into an email or a message."; };
      var fallback = function () { if (status) status.textContent = "Here's the link to copy: " + link; };
      try {
        navigator.clipboard.writeText(link).then(done, fallback);
      } catch (e) {
        fallback();
      }
    });
  }

  if (!("IntersectionObserver" in window)) return;

  // Reached the end of the story.
  var end = document.querySelector(".story-end");
  if (end) {
    var endWatcher = new IntersectionObserver(function (entries) {
      if (!entries[entries.length - 1].isIntersecting) return;
      endWatcher.disconnect();
      if (typeof window.gtag === "function") window.gtag("event", "story_finished", { story: slug });
    });
    endWatcher.observe(end);
  }

  // Phones: the bottom bar.
  var bar = document.querySelector("[data-sticky-cta]");
  var title = document.querySelector(".story h1");
  if (!bar || !title) return;
  var pastTitle = false;
  var stops = [];
  function update() {
    var stopOnScreen = stops.some(function (stop) { return stop.onScreen; });
    bar.classList.toggle("is-shown", pastTitle && !stopOnScreen);
  }
  new IntersectionObserver(function (entries) {
    var entry = entries[entries.length - 1];
    pastTitle = !entry.isIntersecting && entry.boundingClientRect.top < 0;
    update();
  }).observe(title);
  [["#tommy-stories", "0px 0px -33% 0px"], [".site-footer", "0px"]].forEach(function (pair) {
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
