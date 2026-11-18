// What's inside each issue (home page): the envelope opens when it scrolls
// into view, the month's booklet and the surprise rise out of it, and then
// the contents appear. The page shows everything open to begin with; this
// script closes the envelope only when it can open it again, and never for
// readers who've asked their device for less motion.
(function () {
  var section = document.querySelector("[data-mail-open]");
  var envelope = section && section.querySelector(".mail-open");
  if (!envelope) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!("IntersectionObserver" in window)) return;

  section.classList.add("mail-ready");

  var watcher = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isIntersecting) {
        watcher.disconnect();
        // A short pause so the reader sees the closed envelope first.
        setTimeout(function () { section.classList.add("is-open"); }, 250);
        return;
      }
    }
  }, { threshold: 0.6 });
  watcher.observe(envelope);
})();
