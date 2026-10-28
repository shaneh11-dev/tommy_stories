/* Story and letter forms (Share your story, Write to Tommy):
   - shows how the reader's name will appear in print, as they type
   - asks for a last initial when the chosen byline uses one
   - on the story form, asks for an email or a mailing address so we can
     reach the writer (forms marked data-contact-required)
   - on the letter form, hides the byline choice if the reader says the
     letter is just for Tommy and not for print */
(function () {
  var forms = document.querySelectorAll("form[data-byline]");

  forms.forEach(function (form) {
    var first = form.querySelector('[name="first-name"]');
    var initial = form.querySelector('[name="last-initial"]');
    var city = form.querySelector('[name="city"]');
    var state = form.querySelector('[name="state"]');
    var email = form.querySelector('[name="email"]');
    var street = form.querySelector('[name="street"]');
    var nameOut = form.querySelector(".byline-preview-name");
    var placeOut = form.querySelector(".byline-preview-place");
    var bylines = form.querySelectorAll('input[name="byline"]');
    var printOnly = form.querySelectorAll("[data-print-only]");
    var needsContact = form.hasAttribute("data-contact-required");

    function printing() {
      var no = form.querySelector('input[name="print"][value="No"]');
      return !(no && no.checked);
    }

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
      var needsInitial = printing() && (chosen() === "first-initial" || chosen() === "initials");
      initial.setCustomValidity(needsInitial && !initial.value
        ? "Please choose your last initial, or pick a different way to show your name." : "");
      if (needsContact) {
        email.setCustomValidity(!email.value.trim() && !street.value.trim()
          ? "Please give an email address or a mailing address so we can reach you about your story." : "");
      }
      printOnly.forEach(function (el) { el.hidden = !printing(); });
    }

    function refresh() { preview(); check(); }
    form.addEventListener("input", refresh);
    form.addEventListener("change", refresh);
    form.addEventListener("submit", function (event) {
      check();
      if (!form.checkValidity()) {
        event.preventDefault();
        form.reportValidity();
      }
    });
    refresh();
  });
})();
