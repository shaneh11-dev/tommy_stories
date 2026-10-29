/* Confirmation emails for the Share your story and Write to Tommy forms.

   Netlify runs this function on its own after every form submission that
   passes its spam check. The file name, submission-created, is what tells
   Netlify to do that; it can't be called from the web.

   The email goes out through the support@ mailbox in Zoho, using the
   SMTP_USER and SMTP_PASS settings in Netlify (see the README, "Confirmation
   emails"). Until those are set, or when a reader leaves the email box
   empty, nothing is sent and the forms work exactly as before.

   On purpose, the email never repeats what the reader wrote: only their
   first name and the byline they chose. That way nobody can use our forms
   to send someone else a message that looks like it came from us. */
import nodemailer from "nodemailer";

const SUPPORT = "support@tommystories.com";
const TOMMY = "tommy@tommystories.com";
const ADDRESS = "Tommy Stories, 3151 Cape Horn Rd, Unit #2079, Red Lion, PA 17356";

const BYLINE_STYLES = {
  "First name, last initial, city and state": "first-initial",
  "First name, city and state": "first",
  "Initials, city and state": "initials",
  "Anonymous": "anonymous",
};

export default async (req) => {
  let payload;
  try {
    ({ payload } = await req.json());
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const message = buildMessage(payload, process.env.URL);
  if (!message) return new Response("No confirmation to send");

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    console.log("Confirmation emails are off: add SMTP_USER and SMTP_PASS in Netlify.");
    return new Response("Confirmation emails are off");
  }

  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtppro.zoho.com",
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });

  try {
    await transport.sendMail({ from: { name: "Tommy Stories", address: user }, ...message });
    console.log(`Confirmation sent (${payload.form_name}).`);
  } catch (error) {
    // Always answer OK so Netlify doesn't retry and send the reader a second copy.
    console.error(`Confirmation email failed (${payload.form_name}): ${error.message}`);
  }
  return new Response("OK");
};

/* Builds the email for one submission, or returns null when there's nothing
   to send (another form, the spam trap was filled in, or no usable email). */
export function buildMessage(payload, siteUrl) {
  const form = payload && payload.form_name;
  const data = (payload && payload.data) || {};
  if (form !== "story-submission" && form !== "letter-to-tommy") return null;
  if (String(data.company || "").trim()) return null;

  const to = emailAddress(data.email);
  if (!to) return null;

  const site = String(siteUrl || "https://tommystories.com").replace(/\/+$/, "");
  const first = plainText(data["first-name"], 30);
  const date = longDate(payload.created_at);
  const byline = bylineFor(data);
  const isStory = form === "story-submission";
  const printing = isStory || data.print !== "No";

  const lines = isStory
    ? {
        subject: "We received your story",
        opening: `Thank you for sending your story to Tommy Stories. It reached us on ${date}, and we'll read it carefully.`,
        bylineIntro: "If we print it, your name will appear as:",
        steps: [
          "If we'd like to print your story, we'll contact you first. We only fix spelling, grammar and typos, so the words stay yours.",
          "Because we receive so many stories, we can't publish every one, and a story may run several months after it's sent.",
        ],
        invite: ["Have another story? You're welcome to send it too:", `${site}/share/`],
        formName: "Share your story",
        replyTo: SUPPORT,
      }
    : {
        subject: "Tommy got your letter",
        opening: `Thank you for writing to Tommy. Your letter reached us on ${date}.`,
        bylineIntro: "If it's printed, your name will appear as:",
        steps: printing
          ? [
              "You said we may print it, so it could appear in Letters to Tommy in a future issue.",
              "We read every letter, but we can't print every one.",
            ]
          : ["You asked us to keep it just for Tommy, so it won't appear in the magazine."],
        invite: ["Have a story of your own? You're welcome to share it:", `${site}/share/`],
        formName: "Write to Tommy",
        replyTo: TOMMY,
      };

  const greeting = first ? `Dear ${first},` : "Hello,";
  const showByline = printing && byline;
  const footer = `You're getting this one-time email because this address was entered on our ${lines.formName} form. If that wasn't you, please ignore it.`;

  const text = [
    greeting,
    "",
    lines.opening,
    "",
    ...(showByline ? [lines.bylineIntro, `    ${byline}`, "If that isn't right, just reply to this email.", ""] : []),
    ...lines.steps.map((step) => `- ${step}`),
    "",
    lines.invite[0],
    lines.invite[1],
    "",
    "Warmly,",
    "The Tommy Story Family",
    "",
    "--",
    ADDRESS,
    `Questions? ${SUPPORT}`,
    footer,
  ].join("\n");

  const p = 'style="margin:0 0 16px"';
  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px 12px;background:#F2F5FA">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-top:6px solid #004185;padding:28px 28px 20px;font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:1.6;color:#16223A">
<p style="margin:0 0 20px;font-size:26px;font-weight:bold;color:#004185">Tommy <span style="font-style:italic;color:#A8833B">Stories</span></p>
<p ${p}>${escapeHtml(greeting)}</p>
<p ${p}>${escapeHtml(lines.opening)}</p>
${showByline ? `<p ${p}>${escapeHtml(lines.bylineIntro)}<br><strong>${escapeHtml(byline)}</strong><br>If that isn't right, just reply to this email.</p>` : ""}
<ul style="margin:0 0 16px;padding-left:22px">${lines.steps.map((step) => `<li style="margin:0 0 8px">${escapeHtml(step)}</li>`).join("")}</ul>
<p ${p}>${escapeHtml(lines.invite[0])}<br><a href="${escapeHtml(lines.invite[1])}" style="color:#004185">${escapeHtml(lines.invite[1].replace(/^https?:\/\//, ""))}</a></p>
<p style="margin:0 0 24px">Warmly,<br>The Tommy Story Family</p>
<p style="margin:0;padding-top:14px;border-top:1px solid #D3DCE8;font-size:15px;line-height:1.5;color:#4A5568">${escapeHtml(ADDRESS)}<br>Questions? <a href="mailto:${SUPPORT}" style="color:#004185">${SUPPORT}</a><br>${escapeHtml(footer)}</p>
</div>
</body>
</html>`;

  return { to, replyTo: lines.replyTo, subject: lines.subject, text, html };
}

/* The byline exactly as the form's preview showed it, e.g. "Shawn R. — Columbus, OH". */
function bylineFor(data) {
  const style = BYLINE_STYLES[data.byline] || "first-initial";
  if (style === "anonymous") return "Anonymous";
  const first = plainText(data["first-name"], 30);
  if (!first) return "";
  const initial = /^[A-Z]$/.test(data["last-initial"] || "") ? data["last-initial"] : "";
  const city = plainText(data.city, 40);
  const state = /^[A-Z]{2}$/.test(data.state || "") ? data.state : "";

  let name = first;
  if (style === "first-initial" && initial) name = `${first} ${initial}.`;
  if (style === "initials") name = `${first.charAt(0).toUpperCase()}.${initial ? `${initial}.` : ""}`;
  return city && state ? `${name} — ${city}, ${state}` : name;
}

/* Keeps only letters, spaces, apostrophes, periods and hyphens, and breaks
   up anything shaped like a web address ("evil.example"), so a name or town
   can't carry a link into the email. "St. Louis" and "J.R." are left alone.
   A name typed all in lowercase gets capital letters ("mary" -> "Mary"). */
function plainText(value, max) {
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

function emailAddress(value) {
  const address = String(value || "").trim();
  if (address.length > 254) return "";
  return /^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[A-Za-z]{2,}$/.test(address) ? address : "";
}

function longDate(value) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(Number.isNaN(date.getTime()) ? new Date() : date);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
