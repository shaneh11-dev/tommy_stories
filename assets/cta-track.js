// Button tracking: tells Google Analytics whenever someone clicks a link to
// subscribe or give a gift, and where on the page it was. Every page loads
// this file.
//
// The event is "cta_click" with three details:
// - cta_link: where the link goes, e.g. "/join/", "/gift/", "/join/monthly",
//   "/gift/12" (the last two are the plan buttons that open Stripe checkout)
// - cta_location: which part of the page it was in, e.g. "hero",
//   "story_middle", "story_end_offer", "sticky_bar", "header_menu"
// - cta_text: the button's words, e.g. "Start my subscription"
//
// To see cta_link and cta_location in GA reports, register each as an
// event-scoped custom dimension (README, "Google Analytics").
(function () {
  // The first match wins, so the more specific places come first.
  var PLACES = [
    [".sticky-cta", "sticky_bar"],
    [".story-midcard", "story_middle"],
    [".story-offer", "story_end_offer"],
    [".story-more", "story_more"],
    [".site-header", "header_menu"],
    [".site-footer", "footer"],
    [".hero", "hero"]
  ];

  function placeOf(link) {
    var marked = link.closest("[data-cta-location]");
    if (marked) return marked.getAttribute("data-cta-location");
    for (var i = 0; i < PLACES.length; i++) {
      if (link.closest(PLACES[i][0])) return PLACES[i][1];
    }
    // Otherwise name it after its section: the section's id, or else its
    // heading ("Choose your subscription" becomes "choose_your_subscription").
    var section = link.closest("section");
    if (!section) return "page";
    var heading = section.querySelector("h1, h2");
    var name = section.id || (heading ? heading.textContent : "") || "page";
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest("a[href]");
    if (!link || typeof window.gtag !== "function") return;
    var url;
    try {
      url = new URL(link.getAttribute("href"), location.href);
    } catch (e) {
      return;
    }
    if (url.origin !== location.origin) return;
    if (!/^\/(join|gift)(\/|$)/.test(url.pathname)) return;
    window.gtag("event", "cta_click", {
      cta_link: url.pathname,
      cta_location: placeOf(link),
      cta_text: (link.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60)
    });
  });
})();
