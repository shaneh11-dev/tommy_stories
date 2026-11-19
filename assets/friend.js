// Share with a friend: the friend's email can't be the reader's own. The
// site sends nothing in that case (netlify/lib/friend.mjs), so say so on
// the page before the form is sent.
(function () {
  var mine = document.getElementById("your-email");
  var theirs = document.getElementById("friend-email");
  if (!mine || !theirs) return;
  function check() {
    var same = mine.value.trim() !== "" &&
      mine.value.trim().toLowerCase() === theirs.value.trim().toLowerCase();
    theirs.setCustomValidity(same ? "Please enter your friend's email, not your own." : "");
  }
  mine.addEventListener("input", check);
  theirs.addEventListener("input", check);
})();
