/* Share your story form:
   - shows how the reader's name will appear in print, as they type
   - asks for a last initial when the chosen byline uses one
   - asks for an email or a mailing address, so we can reach them about their story */
(function () {
  var form = document.querySelector('form[name="story-submission"]');
  if (!form) return;

  var first = form.querySelector("#first-name");
  var initial = form.querySelector("#last-initial");
  var city = form.querySelector("#city");
  var state = form.querySelector("#state");
  var email = form.querySelector("#email");
  var street = form.querySelector("#street");
  var nameOut = form.querySelector(".byline-preview-name");
  var placeOut = form.querySelector(".byline-preview-place");
  var bylines = form.querySelectorAll('input[name="byline"]');

  function chosen() {
    for (var i = 0; i < bylines.length; i++) if (bylines[i].checked) return bylines[i].dataset.style;
    return "first-initial";
  }

  function preview() {
    var f = first.value.trim() || "Shawn";
    var i = initial.value || (first.value.trim() ? "" : "R");
    var place = (city.value.trim() || "Columbus") + ", " + (state.value || "OH");
    var style = chosen();
    var name = f;
    if (style === "first-initial") name = i ? f + " " + i + "." : f;
    if (style === "initials") name = f.charAt(0).toUpperCase() + "." + (i ? i + "." : "");
    if (style === "anonymous") {
      nameOut.textContent = "Anonymous";
      placeOut.hidden = true;
      return;
    }
    nameOut.textContent = name;
    placeOut.hidden = false;
    placeOut.textContent = "— " + place;
  }

  function check() {
    var needsInitial = chosen() === "first-initial" || chosen() === "initials";
    initial.setCustomValidity(needsInitial && !initial.value
      ? "Please choose your last initial, or pick a different way to show your name." : "");
    email.setCustomValidity(!email.value.trim() && !street.value.trim()
      ? "Please give an email address or a mailing address so we can reach you about your story." : "");
  }

  form.addEventListener("input", function () { preview(); check(); });
  form.addEventListener("change", function () { preview(); check(); });
  form.addEventListener("submit", function (event) {
    check();
    if (!form.checkValidity()) {
      event.preventDefault();
      form.reportValidity();
    }
  });
  preview();
  check();
})();
