// Phones: the header menu folds behind a "Menu" button, so the page itself
// starts near the top of the screen. Tablets and computers never see the
// button (styles.css), and without JavaScript the menu simply stays open.
(function () {
  var header = document.querySelector(".site-header");
  var button = header && header.querySelector(".menu-button");
  var menu = document.getElementById("site-menu");
  if (!button || !menu) return;

  var label = button.querySelector(".menu-button-label");

  function setOpen(open) {
    header.classList.toggle("menu-open", open);
    button.setAttribute("aria-expanded", open ? "true" : "false");
    if (label) label.textContent = open ? "Close" : "Menu";
  }

  header.classList.add("menu-ready");
  button.hidden = false;

  button.addEventListener("click", function () {
    setOpen(button.getAttribute("aria-expanded") !== "true");
  });

  // Escape closes it and puts the reader back on the button.
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && header.classList.contains("menu-open")) {
      setOpen(false);
      button.focus();
    }
  });

  // Choosing a link (including one that jumps down this page) closes it.
  menu.addEventListener("click", function (event) {
    if (event.target.closest && event.target.closest("a")) setOpen(false);
  });
})();
