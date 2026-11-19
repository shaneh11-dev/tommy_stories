/* Share with a friend: the "Stop all emails from Tommy Stories" link at the
   bottom of every invitation and reminder (tommystories.com/friend/stop).

   Opening the link shows a page with one button, so an email program that
   checks links ahead of time can't stop the emails by accident. Email
   programs with a one-click "Unsubscribe" button send a POST, which stops
   them right away. Either way the address is never emailed by us again
   (netlify/lib/friend.mjs). */
import { getStore } from "@netlify/blobs";
import { stopEmails } from "../lib/friend.mjs";

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  const valid = /^[0-9a-f]{64}$/.test(id);

  if (req.method === "POST" && valid) {
    const store = getStore({ name: "friend-invites", consistency: "strong" });
    await stopEmails(id, { store });
    return page(
      "You won't hear from us again",
      "<p>We've stopped all emails from Tommy Stories to your address. Sorry for the bother.</p>"
    );
  }

  if (!valid) {
    return page(
      "That link didn't work",
      `<p>To stop emails from us, just reply to the email you received, or write to <a href="mailto:support@tommystories.com">support@tommystories.com</a>, and we'll take care of it.</p>`,
      400
    );
  }

  return page(
    "Stop emails from Tommy Stories?",
    `<p>A friend asked us to tell you about Tommy Stories. If you'd rather not hear from us, press the button and we won't email you again.</p>
        <form method="POST" action="/friend/stop?id=${id}">
          <button class="button button--primary" type="submit">Stop all emails</button>
        </form>`
  );
};

function page(title, body, status = 200) {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${title} | Tommy Stories</title>
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/styles.css?v=20261119b">
</head>
<body>
  <header class="site-header">
    <div class="wrap header-inner">
      <a class="brand" href="/">
        <span class="wordmark"><span class="wordmark-first">Tommy</span> <span class="wordmark-second">Stories</span></span>
        <span class="tagline">Car Stories that touch life, family, and faith</span>
      </a>
    </div>
  </header>
  <div class="masthead-rule" aria-hidden="true"></div>
  <main id="main">
    <section class="section">
      <div class="wrap prose">
        <h1>${title}</h1>
        ${body}
      </div>
    </section>
  </main>
</body>
</html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export const config = {
  path: "/friend/stop",
};
