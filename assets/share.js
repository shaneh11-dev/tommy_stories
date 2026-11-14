/* Story and letter forms (Share your story, Write to Tommy):
   - shows how the reader's name will appear in print, as they type
   - asks for a last initial when the chosen byline uses one
   - on the story form, asks for an email or a mailing address so we can
     reach the writer (forms marked data-contact-required)
   - on the letter form, hides the byline choice if the reader says the
     letter is just for Tommy and not for print
   - on the thank-you pages, says which address the confirmation email
     is going to (the email itself is sent by netlify/functions)
   - shrinks story photos to print size before they're sent, and stops a
     submission whose files add up to more than Netlify's 8 MB limit */
(function () {
  var forms = document.querySelectorAll("form[data-byline]");
  var MAX_UPLOAD = 7500000;    // Netlify accepts up to 8 MB per submission
  var PHOTO_MAX_SIDE = 2000;   // plenty for a 5.5-inch page at 300 dpi

  /* Phone photos are often 3-6 MB. Redraw a large photo at most 2000 px on
     its long side as a JPEG, then swap it into the file box. Anything that
     can't be redrawn (HEIC on most computers, older browsers) is left as is. */
  function shrinkPhoto(input, done) {
    var file = input.files && input.files[0];
    if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type) || file.size < 1500000 ||
        typeof DataTransfer === "undefined" || !window.URL) { done(); return; }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(function (blob) {
        try {
          if (blob && blob.size < file.size) {
            var list = new DataTransfer();
            list.items.add(new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
            input.files = list.files;
          }
        } catch (e) { /* keep the original photo */ }
        done();
      }, "image/jpeg", 0.85);
    };
    img.onerror = function () { URL.revokeObjectURL(url); done(); };
    img.src = url;
  }

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
    var fileInputs = form.querySelectorAll('input[type="file"]');
    var submitButton = form.querySelector('button[type="submit"]');
    var submitLabel = submitButton ? submitButton.textContent : "";
    var shrinking = 0;

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

      var total = 0, lastFile = null;
      fileInputs.forEach(function (input) {
        input.setCustomValidity("");
        if (input.files && input.files[0]) { total += input.files[0].size; lastFile = input; }
      });
      if (lastFile && total > MAX_UPLOAD) {
        lastFile.setCustomValidity("Your files add up to more than 8 MB. Try smaller files, or email them to support@tommystories.com.");
      }
    }

    form.querySelectorAll("input[data-shrink]").forEach(function (input) {
      input.addEventListener("change", function () {
        shrinking += 1;
        if (submitButton) { submitButton.disabled = true; submitButton.textContent = "Preparing photos\u2026"; }
        shrinkPhoto(input, function () {
          shrinking -= 1;
          if (!shrinking && submitButton) { submitButton.disabled = false; submitButton.textContent = submitLabel; }
          refresh();
        });
      });
    });

    function refresh() { preview(); check(); }
    form.addEventListener("input", refresh);
    form.addEventListener("change", refresh);
    form.addEventListener("submit", function (event) {
      if (shrinking) { event.preventDefault(); return; }
      check();
      if (!form.checkValidity()) {
        event.preventDefault();
        form.reportValidity();
        return;
      }
      // Remember the email address for the thank-you page, which says
      // where the confirmation is going (this browser tab only).
      try {
        sessionStorage.setItem("tommy-confirm", JSON.stringify({ email: email ? email.value.trim() : "" }));
      } catch (e) { /* storage blocked: the page shows its general wording */ }
    });
    refresh();
  });

  /* Thank-you pages: "We're sending a confirmation to you@example.com",
     or nothing about email if the reader didn't give an address. */
  var note = document.querySelector("[data-confirm-email]");
  if (note) {
    var saved = null;
    try {
      saved = JSON.parse(sessionStorage.getItem("tommy-confirm") || "null");
      sessionStorage.removeItem("tommy-confirm");
    } catch (e) { saved = null; }
    if (saved && saved.email) {
      var strong = document.createElement("strong");
      strong.textContent = saved.email;
      var support = document.createElement("a");
      support.href = "mailto:support@tommystories.com";
      support.textContent = "support@tommystories.com";
      note.textContent = "";
      note.append("We're sending a confirmation email to ", strong,
        ". If it hasn't arrived in a few minutes, please check your spam or junk folder. If that address has a typo, email us at ",
        support, ".");
    } else if (saved) {
      note.hidden = true;
    }
  }
})();
