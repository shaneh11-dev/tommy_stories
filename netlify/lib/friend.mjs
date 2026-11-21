/* Share with a friend: the invitations, the reader's copy, the one reminder,
   and the "stop emailing me" link.

   How it works
   - A reader fills in /friend/: their name and email, up to 10 friends'
     email addresses, and a note (required: it's how the friends know who
     the invitation is from, so readers sign it). Netlify checks the form for
     spam, then runs
     netlify/functions/submission-created.mjs, which calls
     handleFriendInvite() below.
   - We email each friend their own invitation from Tommy Stories, with the
     same note and a link to their invitation page (/friend/invitation/),
     which shows the friend offer, and email the reader one copy saying who
     was invited.
   - The friend's emails are written as plain letters, with no names (the
     reader signs their note), no prices and no buttons, so they read like a
     note from a friend (and are less likely to land in Gmail's Promotions
     tab). The price and terms are on the invitation page, before checkout.
   - Seven days later, netlify/functions/friend-reminders.mjs sends each
     friend one short reminder. Then nothing more, ever.
   - Every email to a friend has a link (netlify/functions/friend-stop.mjs)
     that stops all emails from us to that address.

   Keeping it from being misused (anyone can fill in a web form):
   - Addresses that asked us to stop are never emailed again. Otherwise an
     address can be invited again (by the same reader or another one); each
     invitation brings its own one reminder a week later.
   - One reader's email address can send at most 10 invitations a day (one
     form holds up to 10 friends).
   - The note is plain text, at most 300 characters, with web addresses and
     email addresses taken out, so it can't carry a link.
   - After the reminder goes out, we forget the invitation, including the
     friend's email address. For addresses that asked us to stop, we keep
     only a scrambled fingerprint (a SHA-256 hash), enough to recognize them.

   The offer itself is set up in Stripe (see README, "Share with a friend"):
   /join/friend opens the Monthly checkout with the friend code applied. */
import { createHash } from "node:crypto";

export const OFFER = {
  price: "$12.99",
  regular: "$16.99",
  months: 3,
};

export const MAX_FRIENDS = 10;
const SUPPORT = "support@tommystories.com";
const ADDRESS = "Tommy Stories, 3151 Cape Horn Rd, Unit #2079, Red Lion, PA 17356";
const DAILY_LIMIT = 10;
const REMIND_AFTER_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

/* One form submission. `store` holds what we remember between emails
   (Netlify Blobs in production); `send` sends one email. Returns a short
   line for the log, like "sent 3, stopped 1, held 0, failed 0". */
export async function handleFriendInvite(payload, { store, send, site, now = new Date() }) {
  const data = (payload && payload.data) || {};
  if (String(data.company || "").trim()) return "skipped";

  const sender = plainName(data["your-name"], 40);
  const senderEmail = emailAddress(data["your-email"]);
  const note = plainNote(data.note);
  if (!sender || !senderEmail) return "skipped";

  // Up to 10 friends: friend-email-1 to friend-email-10. (friend-email is
  // from the form's first version.) The reader's own address and repeats
  // are left out.
  const friends = [];
  const seen = new Set([senderEmail.toLowerCase()]);
  const fields = ["friend-email", ...Array.from({ length: MAX_FRIENDS }, (_, i) => `friend-email-${i + 1}`)];
  for (const field of fields) {
    const email = emailAddress(data[field]);
    if (!email || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    friends.push({ email });
    if (friends.length === MAX_FRIENDS) break;
  }
  if (!friends.length) return "skipped";

  site = String(site || "https://tommystories.com").replace(/\/+$/, "");
  const dayKey = `sender/${fingerprint(senderEmail)}/${now.toISOString().slice(0, 10)}`;
  let sentToday = Number((await store.get(dayKey)) || 0);
  const results = { sent: [], stopped: [], held: [], failed: [] };

  for (const friend of friends) {
    const friendKey = fingerprint(friend.email);
    if (await store.get(`stop/${friendKey}`)) {
      results.stopped.push(friend);
      continue;
    }
    if (sentToday >= DAILY_LIMIT) {
      results.held.push(friend);
      continue;
    }
    try {
      await send(invitation({ friendEmail: friend.email, note, site, stopId: friendKey }));
    } catch (error) {
      console.error(`Invitation failed: ${error.message}`);
      results.failed.push(friend);
      continue;
    }
    // A repeat invitation replaces the earlier one, with a fresh reminder date.
    await store.setJSON(`invite/${friendKey}`, {
      sentAt: now.toISOString(),
      remindAt: new Date(now.getTime() + REMIND_AFTER_DAYS * DAY).toISOString(),
      friendEmail: friend.email,
    });
    sentToday += 1;
    await store.set(dayKey, String(sentToday));
    results.sent.push(friend);
  }

  await send(readerCopy({ sender, senderEmail, results, site }));
  return `sent ${results.sent.length}, stopped ${results.stopped.length}, held ${results.held.length}, failed ${results.failed.length}`;
}

/* Runs once a day: sends the one reminder to friends invited a week ago,
   then forgets the invitation. Returns how many reminders went out. */
export async function sendDueReminders({ store, send, site, now = new Date() }) {
  site = String(site || "https://tommystories.com").replace(/\/+$/, "");
  const { blobs } = await store.list({ prefix: "invite/" });
  let sent = 0;
  for (const { key } of blobs) {
    const invite = await store.get(key, { type: "json" });
    if (!invite) continue;
    // Left over from before November 2026, when finished invitations were
    // kept to stop repeat invitations: no longer needed.
    if (invite.reminded || !invite.friendEmail) {
      await store.delete(key);
      continue;
    }
    if (new Date(invite.remindAt) > now) continue;
    const friendKey = key.slice("invite/".length);
    const stopped = await store.get(`stop/${friendKey}`);
    if (!stopped) {
      try {
        await send(reminder({ ...invite, site, stopId: friendKey }));
        sent += 1;
      } catch (error) {
        console.error(`Reminder failed: ${error.message}`);
        continue; // try again tomorrow
      }
    }
    // Done with this invitation: forget it, email address and all.
    await store.delete(key);
  }
  return sent;
}

/* The friend clicked "stop emails": never email this address again. */
export async function stopEmails(stopId, { store, now = new Date() }) {
  if (!/^[0-9a-f]{64}$/.test(String(stopId || ""))) return false;
  await store.setJSON(`stop/${stopId}`, { at: now.toISOString() });
  // No reminder after this, and no need to remember the address.
  await store.delete(`invite/${stopId}`);
  return true;
}

/* ---------- The emails ---------- */

/* The friend's emails name nobody: the reader's note (which they sign) says
   who it's from. */
export function invitation({ friendEmail, note, site, stopId }) {
  const page = `${site}/friend/invitation/`;
  const stop = `${site}/friend/stop?id=${stopId}`;
  const subject = "A friend referred you to Tommy Stories";
  const opening = `A friend has referred you to our invite-only mail club, Tommy Stories.${note ? " They left you a note:" : ""}`;
  const about = "Every month, Tommy Stories mails a large-print booklet of four true stories from everyday people about the cars in their lives, and about the life, family and faith those stories are really about.";
  const welcome = "A special friend's rate is waiting for you here:";
  const why = "A friend entered your email address on our Share with a friend page. We'll send you one short reminder next week, and that's all. We won't add you to a mailing list.";

  const text = [
    opening,
    ...(note ? ["", ...note.split("\n").map((line) => `    ${line}`)] : []),
    "",
    about,
    "",
    welcome,
    page,
    "",
    "Warmly,",
    "The Tommy Stories Family",
    "",
    "--",
    ADDRESS,
    `Questions? ${SUPPORT}`,
    why,
    `To stop all emails from us: ${stop}`,
  ].join("\n");

  const html = letter(`
<p ${P}>${esc(opening)}</p>
${note ? `<p style="margin:0 0 16px;padding-left:14px;border-left:3px solid #D4B06A;font-style:italic">${esc(note).replace(/\n/g, "<br>")}</p>` : ""}
<p ${P}>${esc(about)}</p>
<p style="margin:0 0 6px">${esc(welcome)}</p>
<p ${P}>${link(page, "Open your invitation")}</p>
<p style="margin:0">Warmly,<br>The Tommy Stories Family</p>`,
    `${esc(ADDRESS)}<br>Questions? <a href="mailto:${SUPPORT}" style="color:#004185">${SUPPORT}</a><br>${esc(why)}<br><a href="${esc(stop)}" style="color:#004185">Stop all emails from Tommy Stories</a>`);

  return { to: friendEmail, replyTo: SUPPORT, subject, text, html };
}

export function reminder({ friendEmail, site, stopId }) {
  const page = `${site}/friend/invitation/`;
  const stop = `${site}/friend/stop?id=${stopId}`;
  const subject = "A reminder: a friend referred you to Tommy Stories";
  const lines = [
    "Last week, a friend referred you to Tommy Stories, our monthly large-print booklet of true car stories about life, family and faith.",
    "Your invitation, with its special friend's rate, is still waiting for you here:",
  ];
  const closing = "If you've already subscribed, welcome, and thank you! Either way, this is the last email we'll send you about it.";

  const text = [
    lines[0],
    "",
    lines[1],
    page,
    "",
    closing,
    "",
    "Warmly,",
    "The Tommy Stories Family",
    "",
    "--",
    ADDRESS,
    `Questions? ${SUPPORT}`,
    `To stop all emails from us: ${stop}`,
  ].join("\n");

  const html = letter(`
<p ${P}>${esc(lines[0])}</p>
<p style="margin:0 0 6px">${esc(lines[1])}</p>
<p ${P}>${link(page, "Open your invitation")}</p>
<p ${P}>${esc(closing)}</p>
<p style="margin:0">Warmly,<br>The Tommy Stories Family</p>`,
    `${esc(ADDRESS)}<br>Questions? <a href="mailto:${SUPPORT}" style="color:#004185">${SUPPORT}</a><br><a href="${esc(stop)}" style="color:#004185">Stop all emails from Tommy Stories</a>`);

  return { to: friendEmail, replyTo: SUPPORT, subject, text, html };
}

/* The reader's copy: who was invited, and anyone who wasn't, and why. It
   never repeats their note, so it can't be used to send someone a message. */
export function readerCopy({ sender, senderEmail, results, site }) {
  const first = sender.split(" ")[0];
  const host = site.replace(/^https?:\/\//, "");
  const { sent, stopped, held, failed } = results;
  const total = sent.length + stopped.length + held.length + failed.length;
  const label = (f) => f.email;
  const allSent = sent.length === total;
  const subject = total === 1
    ? (allSent ? `Your invitation to ${sent[0].email} is on its way` : "About your invitation to Tommy Stories")
    : (allSent ? "Your invitations are on their way" : "About your invitations to Tommy Stories");

  const sections = [];
  if (sent.length) {
    sections.push({
      line: `We've emailed your invitation, with your note and the friend offer (${OFFER.price} a month for their first ${OFFER.months} months), to:`,
      list: sent,
      after: sent.length === 1
        ? "If they haven't subscribed in a week, we'll send them one short reminder, and that's all."
        : "If they haven't subscribed in a week, we'll send each of them one short reminder, and that's all.",
    });
  }
  if (stopped.length) {
    sections.push({ line: "These addresses have asked us not to email them, so we didn't send an invitation:", list: stopped });
  }
  if (held.length) {
    sections.push({ line: `You can send up to ${DAILY_LIMIT} invitations a day, so we held these back. Please try them again tomorrow at ${host}/friend:`, list: held });
  }
  if (failed.length) {
    sections.push({ line: `Something went wrong sending to these, so please try them again later at ${host}/friend:`, list: failed });
  }
  const footer = "You're getting this one-time email because this address was entered on our Share with a friend page. If that wasn't you, please ignore it.";

  const text = [
    `Dear ${first},`,
    "",
    "Thank you for sharing Tommy Stories.",
    "",
    ...sections.flatMap((s) => [s.line, ...s.list.map((f) => `  - ${label(f)}`), "", ...(s.after ? [s.after, ""] : [])]),
    "Warmly,",
    "The Tommy Stories Family",
    "",
    "--",
    ADDRESS,
    `Questions? ${SUPPORT}`,
    footer,
  ].join("\n");

  const html = frame(`
<p ${P}>Dear ${esc(first)},</p>
<p ${P}>Thank you for sharing Tommy Stories.</p>
${sections.map((s) => `<p style="margin:0 0 8px">${esc(s.line)}</p>
<ul style="margin:0 0 16px;padding-left:24px">${s.list.map((f) => `<li>${esc(label(f))}</li>`).join("")}</ul>
${s.after ? `<p ${P}>${esc(s.after)}</p>` : ""}`).join("\n")}
<p style="margin:0 0 24px">Warmly,<br>The Tommy Stories Family</p>`,
    `${esc(ADDRESS)}<br>Questions? <a href="mailto:${SUPPORT}" style="color:#004185">${SUPPORT}</a><br>${esc(footer)}`);

  return { to: senderEmail, replyTo: SUPPORT, subject, text, html };
}

/* ---------- Helpers ---------- */

const P = 'style="margin:0 0 16px"';

function frame(body, footer) {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px 12px;background:#F2F5FA">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-top:6px solid #004185;padding:28px 28px 20px;font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:1.6;color:#16223A">
<p style="margin:0 0 20px;font-size:26px;font-weight:bold;color:#004185">Tommy <span style="font-style:italic;color:#A8833B">Stories</span></p>
${body.trim()}
<p style="margin:0;padding-top:14px;border-top:1px solid #D3DCE8;font-size:15px;line-height:1.5;color:#4A5568">${footer}</p>
</div>
</body>
</html>`;
}

/* The friend's emails: a plain letter on white, like a note from a person,
   rather than a designed newsletter. */
function letter(body, footer) {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:16px 12px;background:#ffffff">
<div style="max-width:560px;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.6;color:#16223A">
${body.trim()}
<p style="margin:28px 0 0;font-size:14px;line-height:1.5;color:#5A6474">${footer}</p>
</div>
</body>
</html>`;
}

function link(href, label) {
  return `<a href="${esc(href)}" style="color:#004185;font-weight:bold">${esc(label)}</a>`;
}

/* A scrambled fingerprint of an email address: the same address always gives
   the same fingerprint, but the address can't be read back from it. */
export function fingerprint(email) {
  return createHash("sha256").update(String(email).trim().toLowerCase()).digest("hex");
}

/* Names: letters, spaces, apostrophes, periods and hyphens only, and nothing
   shaped like a web address ("evil.example"). "Aunt Mary" and "J.R." are fine.
   All-lowercase names get capital letters ("mary smith" -> "Mary Smith"). */
export function plainName(value, max) {
  const text = String(value || "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}' .\-]/gu, "")
    .replace(/\.(?=\p{L}{2})/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
  return text === text.toLowerCase()
    ? text.replace(/(^|[\s\-'])(\p{L})/gu, (_, before, letter) => before + letter.toUpperCase())
    : text;
}

/* The note: plain text, up to 300 characters, at most 4 lines, with web
   addresses and email addresses removed. */
export function plainNote(value) {
  return String(value || "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/(?:https?:\/\/|www\.)\S*/gi, "")
    .replace(/\S+@\S+/g, "")
    .replace(/\S*[\p{L}\d-]\.[a-z]{2,}(?![\p{L}\d])\S*/giu, "")
    .replace(/[^\p{L}\p{M}\p{N} .,!?'"’“”‘:;()&\-\n]/gu, "")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join("\n")
    .slice(0, 300)
    .trim();
}

export function emailAddress(value) {
  const address = String(value || "").trim();
  if (address.length > 254) return "";
  return /^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[A-Za-z]{2,}$/.test(address) ? address : "";
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
