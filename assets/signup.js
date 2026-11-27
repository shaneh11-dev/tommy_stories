// Story email signup (the "Want the next one?" box under each story; see
// README, "Story emails"). Netlify Forms keeps each signup under the form
// "story-emails", with the story page it came from.
//
// With JavaScript the form sends in the background and thanks the reader in
// place, and Google Analytics gets an "email_signup" event (with the story).
// Without JavaScript it posts normally and lands on /emails/thanks/.
(function () {
  var forms = document.querySelectorAll("form[data-signup]");
  Array.prototype.forEach.call(forms, function (form) {
    var box = form.closest("[data-signup-box]") || form.parentNode;
    var status = box.querySelector("[data-signup-status]");
    var button = form.querySelector("button[type=submit]");

    form.addEventListener("submit", function (event) {
      if (!window.fetch || !window.URLSearchParams || !window.FormData) return;
      event.preventDefault();
      if (button) button.disabled = true;
      if (status) status.textContent = "Sending...";

      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(new FormData(form)).toString()
      })
        .then(function (response) {
          if (!response.ok) throw new Error("status " + response.status);
          box.classList.add("is-done");
          form.hidden = true;
          if (status) status.textContent = "You're on the list. Watch your inbox for a free true story each week.";
          if (typeof window.gtag === "function") {
            var story = form.querySelector("input[name=story]");
            window.gtag("event", "email_signup", {
              story: story ? story.value : "",
              signup_location: form.getAttribute("data-signup") || "page"
            });
          }
        })
        .catch(function () {
          if (button) button.disabled = false;
          if (status) status.textContent = "That didn't go through. Please try again, or email us at support@tommystories.com.";
        });
    });
  });
})();
