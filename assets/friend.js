// Share with a friend (friend/index.html):
// - Shows one friend to start, with an "Add another friend" button for up
//   to 5. Without this script, all 5 are shown.
// - A friend's email can't be the reader's own. The site sends nothing in
//   that case (netlify/lib/friend.mjs), so say so before the form is sent.
(function () {
  var mine = document.getElementById("your-email");
  var friends = Array.prototype.slice.call(document.querySelectorAll(".friend"));
  var add = document.querySelector(".add-friend");
  if (!mine || !friends.length) return;

  function emailOf(row) {
    return row.querySelector('input[type="email"]');
  }

  function check() {
    var me = mine.value.trim().toLowerCase();
    friends.forEach(function (row) {
      var input = emailOf(row);
      var same = me !== "" && input.value.trim().toLowerCase() === me;
      input.setCustomValidity(same ? "Please enter your friend's email, not your own." : "");
    });
  }

  mine.addEventListener("input", check);
  friends.forEach(function (row) {
    emailOf(row).addEventListener("input", check);
  });

  if (!add) return;
  // Hide the empty friends after the first, and reveal them one at a time.
  friends.forEach(function (row, i) {
    var filled = Array.prototype.some.call(row.querySelectorAll("input"), function (input) {
      return input.value.trim() !== "";
    });
    if (i > 0 && !filled) row.hidden = true;
  });

  function refresh() {
    add.hidden = !friends.some(function (row) { return row.hidden; });
  }

  add.addEventListener("click", function () {
    for (var i = 0; i < friends.length; i++) {
      if (friends[i].hidden) {
        friends[i].hidden = false;
        friends[i].querySelector("input").focus();
        break;
      }
    }
    refresh();
  });
  refresh();
})();
