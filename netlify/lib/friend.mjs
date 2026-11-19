/* Share with a friend: the invitation, the reader's copy, the one reminder,
   and the "stop emailing me" link.

   How it works
   - A reader fills in /friend/ (their name and email, a friend's first name
     and email, and an optional note). Netlify checks the form for spam, then
     runs netlify/functions/submission-created.mjs, which calls
     handleFriendInvite() below.
   - We email the friend one invitation from Tommy Stories, with the reader's
     note and the friend offer, and email the reader a short copy.
   - Seven days later, netlify/functions/friend-reminders.mjs sends the friend
     one short reminder. Then nothing more, ever.
   - Every email to a friend has a link (netlify/functions/friend-stop.mjs)
     that stops all emails from us to that address.

   Keeping it from being misused (anyone can fill in a web form):
   - Each email address is invited once, ever. Addresses that asked us to
     stop are never emailed again.
   - One reader's email address can send at most 5 invitations a day.
   - The note is plain text, at most 300 characters, with web addresses and
     email addresses taken out, so it can't carry a link.
   - After the reminder goes out, we forget the friend's email address and
     keep only a scrambled fingerprint of it (a SHA-256 hash), which is
     enough to never invite them twice.

   The offer itself is set up in Stripe (see README, "Share with a friend"):
   /join/friend opens the Monthly checkout with the friend code applied. */
import { createHash } from "node:crypto";

export const OFFER = {
  price: "$12.99",
  regular: "$16.99",
  months: 3,
};

const SUPPORT = "support@tommystories.com";
const ADDRESS = "Tommy Stories, 3151 Cape Horn Rd, Unit #2079, Red Lion, PA 17356";
const DAILY_LIMIT = 5;
const REMIND_AFTER_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

/* One form submission. `store` holds what we remember between emails
   (Netlify Blobs in production); `send` sends one email. Returns a short
   word for the log: "sent", "already", "limit" or "skipped". */
export async function handleFriendInvite(payload, { store, send, site, now = new Date() }) {
  const data = (payload && payload.data) || {};
  if (String(data.company || "").trim()) return "skipped";

  const sender = plainName(data["your-name"], 40);
  const senderEmail = emailAddress(data["your-email"]);
  const friend = plainName(data["friend-name"], 30);
  const friendEmail = emailAddress(data["friend-email"]);
  const note = plainNote(data.note);
  if (!sender || !senderEmail || !friend || !friendEmail) return "skipped";
  if (friendEmail.toLowerCase() === senderEmail.toLowerCase()) return "skipped";

  site = String(site || "https://tommystories.com").replace(/\/+$/, "");
  const friendKey = fingerprint(friendEmail);
  const dayKey = `sender/${fingerprint(senderEmail)}/${now.toISOString().slice(0, 10)}`;

  const sentToday = Number((await store.get(dayKey)) || 0);
  if (sentToday >= DAILY_LIMIT) {
    await send(readerCopy({ sender, senderEmail, friend, friendEmail, outcome: "limit", site }));
    return "limit";
  }

  const known = (await store.get(`invite/${friendKey}`)) || (await store.get(`stop/${friendKey}`));
  if (known) {
    await send(readerCopy({ sender, senderEmail, friend, friendEmail, outcome: "already", site }));
    return "already";
  }

  await send(invitation({ sender, friend, friendEmail, note, site, stopId: friendKey }));
  await store.setJSON(`invite/${friendKey}`, {
    sentAt: now.toISOString(),
    remindAt: new Date(now.getTime() + REMIND_AFTER_DAYS * DAY).toISOString(),
    reminded: false,
    friend,
    friendEmail,
    sender,
  });
  await store.set(dayKey, String(sentToday + 1));
  await send(readerCopy({ sender, senderEmail, friend, friendEmail, outcome: "sent", site }));
  return "sent";
}

/* Runs once a day: sends the one reminder to friends invited a week ago,
   then forgets their email address. Returns how many reminders went out. */
export async function sendDueReminders({ store, send, site, now = new Date() }) {
  site = String(site || "https://tommystories.com").replace(/\/+$/, "");
  const { blobs } = await store.list({ prefix: "invite/" });
  let sent = 0;
  for (const { key } of blobs) {
    const invite = await store.get(key, { type: "json" });
    if (!invite || invite.reminded || !invite.friendEmail) continue;
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
    // Done with this friend: keep only when they were invited.
    await store.setJSON(key, { sentAt: invite.sentAt, reminded: true });
  }
  return sent;
}

/* The friend clicked "stop emails": never email this address again. */
export async function stopEmails(stopId, { store, now = new Date() }) {
  if (!/^[0-9a-f]{64}$/.test(String(stopId || ""))) return false;
  await store.setJSON(`stop/${stopId}`, { at: now.toISOString() });
  const invite = await store.get(`invite/${stopId}`, { type: "json" });
  if (invite && !invite.reminded) {
    await store.setJSON(`invite/${stopId}`, { sentAt: invite.sentAt, reminded: true });
  }
  return true;
}

/* ---------- The emails ---------- */

export function invitation({ sender, friend, friendEmail, note, site, stopId }) {
  const join = `${site}/join/friend`;
  const stop = `${site}/friend/stop?id=${stopId}`;
  const subject = `${sender} thought you'd enjoy Tommy Stories`;
  const offer = `Because ${sender} sent you, your first ${OFFER.months} months are ${OFFER.price} a month instead of ${OFFER.regular}. After that it's ${OFFER.regular} a month, shipping included, and you can cancel anytime.`;
  const about = "Tommy Stories is a large-print booklet that comes in the mail every month. Each issue has four true stories from everyday people about the cars in their lives, and about the life, family and faith those stories are really about. There's also a note from Tommy, a Do You Remember? page, Name That Car, a puzzle page, and a little surprise from Tommy in every envelope.";
  const why = `${sender} entered your email address on our Share with a friend page. We'll send you one short reminder next week, and that's all. We won't add you to a mailing list.`;
  const opening = note
    ? `${sender} thought you'd enjoy Tommy Stories and asked us to pass along this note:`
    : `${sender} thought you'd enjoy Tommy Stories and asked us to tell you about it.`;

  const text = [
    `Dear ${friend},`,
    "",
    opening,
    ...(note ? ["", ...note.split("\n").map((line) => `    ${line}`)] : []),
    "",
    about,
    "",
    offer,
    "",
    "Start your subscription:",
    join,
    "",
    `Read more about us at ${site.replace(/^https?:\/\//, "")}.`,
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

  const html = frame(`
<p ${P}>Dear ${esc(friend)},</p>
<p ${P}>${esc(opening)}</p>
${note ? `<p style="margin:0 0 20px;padding:12px 16px;border-left:4px solid #D4B06A;background:#FBF7EE;font-style:italic">${esc(note).replace(/\n/g, "<br>")}</p>` : ""}
<p ${P}>${esc(about)}</p>
<div style="margin:0 0 22px;padding:16px 18px;border:2px dashed #A8833B;border-radius:8px;background:#FFFBF1">
<p style="margin:0 0 4px;font-size:14px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#8A6726">Friend offer</p>
<p style="margin:0;font-size:22px;font-weight:bold;color:#004185">${OFFER.price} a month for your first ${OFFER.months} months</p>
<p style="margin:6px 0 0;font-size:17px">${esc(`Because ${sender} sent you. After that it's ${OFFER.regular} a month, shipping included. Cancel anytime.`)}</p>
</div>
${button(join, "Start my subscription")}
<p ${P}>Read more about us at <a href="${esc(site)}" style="color:#004185">${esc(site.replace(/^https?:\/\//, ""))}</a>.</p>
<p style="margin:0 0 24px">Warmly,<br>The Tommy Stories Family</p>`,
    `${esc(ADDRESS)}<br>Questions? <a href="mailto:${SUPPORT}" style="color:#004185">${SUPPORT}</a><br>${esc(why)}<br><a href="${esc(stop)}" style="color:#004185">Stop all emails from Tommy Stories</a>`);

  return { to: friendEmail, replyTo: SUPPORT, subject, text, html, headers: unsubscribeHeaders(stop) };
}

export function reminder({ sender, friend, friendEmail, site, stopId }) {
  const join = `${site}/join/friend`;
  const stop = `${site}/friend/stop?id=${stopId}`;
  const subject = `A reminder: ${sender}'s invitation to Tommy Stories`;
  const lines = [
    `Last week, ${sender} asked us to tell you about Tommy Stories, our monthly large-print booklet of true car stories about life, family and faith.`,
    `Your friend offer is still here: your first ${OFFER.months} months for ${OFFER.price} a month, then ${OFFER.regular} a month, shipping included. Cancel anytime.`,
  ];
  const closing = "If you've already subscribed, welcome, and thank you! Either way, this is the last email we'll send you about it.";

  const text = [
    `Dear ${friend},`,
    "",
    lines[0],
    "",
    lines[1],
    "",
    "Start your subscription:",
    join,
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

  const html = frame(`
<p ${P}>Dear ${esc(friend)},</p>
<p ${P}>${esc(lines[0])}</p>
<p ${P}>${esc(lines[1])}</p>
${button(join, "Start my subscription")}
<p ${P}>${esc(closing)}</p>
<p style="margin:0 0 24px">Warmly,<br>The Tommy Stories Family</p>`,
    `${esc(ADDRESS)}<br>Questions? <a href="mailto:${SUPPORT}" style="color:#004185">${SUPPORT}</a><br><a href="${esc(stop)}" style="color:#004185">Stop all emails from Tommy Stories</a>`);

  return { to: friendEmail, replyTo: SUPPORT, subject, text, html, headers: unsubscribeHeaders(stop) };
}

/* The reader's copy: what happened with their invitation. It never repeats
   their note, so it can't be used to send someone a message. */
export function readerCopy({ sender, senderEmail, friend, friendEmail, outcome, site }) {
  const first = sender.split(" ")[0];
  const body = {
    sent: {
      subject: `Your invitation to ${friend} is on its way`,
      lines: [
        `Thank you for sharing Tommy Stories. We've emailed your invitation to ${friend} at ${friendEmail}, with your note and the friend offer: ${OFFER.price} a month for their first ${OFFER.months} months.`,
        "If they haven't subscribed in a week, we'll send them one short reminder, and that's all.",
      ],
    },
    already: {
      subject: `About your invitation to ${friend}`,
      lines: [
        `Thank you for sharing Tommy Stories. We've already been in touch with ${friendEmail} before, so we didn't send another invitation. We only ever invite an address once.`,
        `If ${friend} would like to subscribe, they can visit ${site.replace(/^https?:\/\//, "")}/join.`,
      ],
    },
    limit: {
      subject: `About your invitation to ${friend}`,
      lines: [
        `Thank you for sharing Tommy Stories. You've sent several invitations today, so we held this one back. Please try again tomorrow at ${site.replace(/^https?:\/\//, "")}/friend.`,
      ],
    },
  }[outcome];
  const footer = "You're getting this one-time email because this address was entered on our Share with a friend page. If that wasn't you, please ignore it.";

  const text = [
    `Dear ${first},`,
    "",
    ...body.lines.flatMap((line) => [line, ""]),
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
${body.lines.map((line) => `<p ${P}>${esc(line)}</p>`).join("\n")}
<p style="margin:0 0 24px">Warmly,<br>The Tommy Stories Family</p>`,
    `${esc(ADDRESS)}<br>Questions? <a href="mailto:${SUPPORT}" style="color:#004185">${SUPPORT}</a><br>${esc(footer)}`);

  return { to: senderEmail, replyTo: SUPPORT, subject: body.subject, text, html };
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

function button(href, label) {
  return `<p style="margin:0 0 22px"><a href="${esc(href)}" style="display:inline-block;padding:14px 26px;border-radius:6px;background:#004185;color:#ffffff;font-weight:bold;font-size:19px;text-decoration:none">${esc(label)}</a></p>`;
}

function unsubscribeHeaders(stop) {
  return {
    "List-Unsubscribe": `<${stop}>, <mailto:${SUPPORT}?subject=Stop%20emails>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
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
