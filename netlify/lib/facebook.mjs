/* Facebook posts: publishes approved posts from social/posts/ to the
   Tommy Stories Facebook Page at their scheduled times.

   How it works
   - Each post is one text file in social/posts/, named by its date and time
     (2026-11-26-0900-name-that-car.md), with a few setting lines at the top
     and the post text below. See social/README.md for the format.
   - A post is approved by being merged into the website's main branch. Only
     merged posts are on the live site, so only they can be posted.
   - netlify/functions/facebook-poster.mjs runs every 15 minutes and calls
     postDue() below. Any post whose time has come (Eastern time) and that
     hasn't been posted yet is published through Facebook's Pages API.
   - What's been posted is remembered in Netlify Blobs (store "facebook-posts"),
     so nothing posts twice. A post more than 6 hours late (say the site was
     down) is skipped, not posted at an odd hour, and the owner is emailed.
   - Until FB_PAGE_ID and FB_PAGE_TOKEN are set in Netlify, it only logs what
     it would post. */

export const TIME_ZONE = "America/New_York";
const LATE_LIMIT_HOURS = 6;
const GRAPH = "https://graph.facebook.com";

/* ---------- Reading posts ---------- */

/* Parses one post file. The top lines up to "---" are settings
   ("time: 2026-11-26 09:00", "image: name.png", "images: a.png, b.png",
   "link: https://..."); everything after "---" is the post text. */
export function parsePost(name, source) {
  const text = String(source).replace(/\r\n?/g, "\n");
  const split = text.indexOf("\n---\n");
  if (split === -1) throw new Error(`${name}: needs a line with just --- between the settings and the post text`);
  const settings = {};
  for (const line of text.slice(0, split).split("\n")) {
    if (!line.trim() || line.trim() === "---" || line.trim().startsWith("#")) continue;
    const m = line.match(/^\s*([a-z]+)\s*:\s*(.*?)\s*$/i);
    if (!m) throw new Error(`${name}: can't read the setting line "${line}"`);
    settings[m[1].toLowerCase()] = m[2];
  }
  const message = text.slice(split + 5).trim();
  if (!settings.time) throw new Error(`${name}: missing "time:"`);
  const when = easternToDate(settings.time);
  const images = [settings.image, ...(settings.images || "").split(",")]
    .map((s) => (s || "").trim())
    .filter(Boolean);
  const link = (settings.link || "").trim();
  if (link && !/^https:\/\/\S+$/.test(link)) throw new Error(`${name}: the link must start with https://`);
  if (!message && !images.length && !link) throw new Error(`${name}: nothing to post`);
  if (images.length > 10) throw new Error(`${name}: at most 10 images`);
  if (link && images.length) throw new Error(`${name}: use either images or a link card, not both (put the link in the text instead)`);
  const kind = images.length > 1 ? "photos" : images.length === 1 ? "photo" : link ? "link" : "text";
  return { name, time: settings.time, when, kind, images, link, message, skip: /^(yes|true)$/i.test(settings.skip || "") };
}

/* "2026-11-26 09:00" in Eastern time (EST or EDT, whichever applies) as a Date. */
export function easternToDate(value) {
  const m = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/);
  if (!m) throw new Error(`time must look like 2026-11-26 09:00 (got "${value}")`);
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let guess = wall - offsetMinutes(wall) * 60000;
  guess = wall - offsetMinutes(guess) * 60000; // settle on the right side of a clock change
  return new Date(guess);
}

function offsetMinutes(utcMillis) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(new Date(utcMillis)).map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((asUtc - utcMillis) / 60000);
}

/* For the log: how many readable posts are still ahead, and the next one. */
export function upcoming(files, now = new Date()) {
  const ahead = [];
  for (const file of files) {
    try {
      const post = parsePost(file.name, file.source);
      if (!post.skip && post.when > now) ahead.push(post);
    } catch {
      // unreadable files are reported by postDue
    }
  }
  ahead.sort((a, b) => a.when - b.when);
  return ahead.length
    ? `${ahead.length} post${ahead.length === 1 ? "" : "s"} waiting; next: ${ahead[0].name} at ${ahead[0].time} Eastern`
    : "no posts waiting";
}

/* ---------- Posting ---------- */

/* Posts everything that's due. `files` is a list of {name, source}; `readImage`
   returns an image's bytes; `store` remembers what's been posted; `graph`
   calls Facebook (null for a dry run); `notify` emails the owner.
   Returns a list of lines for the log. */
export async function postDue({ files, readImage, store, graph, notify, now = new Date() }) {
  const log = [];
  const problems = [];
  for (const file of files.slice().sort((a, b) => a.name.localeCompare(b.name))) {
    let post;
    try {
      post = parsePost(file.name, file.source);
    } catch (error) {
      // A broken file is reported once, not every 15 minutes.
      if (!(await store.get(`bad/${file.name}`))) {
        await store.set(`bad/${file.name}`, now.toISOString());
        problems.push(`Couldn't read ${file.name}: ${error.message}`);
      }
      log.push(`unreadable ${file.name}: ${error.message}`);
      continue;
    }
    if (post.skip || post.when > now) continue;
    if (await store.get(`posted/${post.name}`)) continue;
    if (await store.get(`missed/${post.name}`)) continue;

    const lateHours = (now - post.when) / 3600000;
    if (lateHours > LATE_LIMIT_HOURS) {
      await store.setJSON(`missed/${post.name}`, { at: now.toISOString() });
      problems.push(`Didn't post ${post.name}: it was due ${post.time} Eastern, more than ${LATE_LIMIT_HOURS} hours ago. Give it a new time if you still want it.`);
      log.push(`missed ${post.name}`);
      continue;
    }

    if (!graph) {
      log.push(`would post ${post.name} (${post.kind}) - Facebook isn't connected yet`);
      continue;
    }

    // Claim it first, so two runs at once can't both post it.
    const claim = await store.get(`posting/${post.name}`);
    if (claim && now - new Date(claim) < 10 * 60000) continue;
    await store.set(`posting/${post.name}`, now.toISOString());

    try {
      const id = await publish(post, { graph, readImage });
      await store.setJSON(`posted/${post.name}`, { at: now.toISOString(), id });
      log.push(`posted ${post.name} as ${id}`);
    } catch (error) {
      log.push(`failed ${post.name}: ${error.message}`);
      const tries = Number((await store.get(`tries/${post.name}`)) || 0) + 1;
      await store.set(`tries/${post.name}`, String(tries));
      await store.delete(`posting/${post.name}`);
      if (tries === 1 || tries === 3) {
        problems.push(`Facebook didn't accept ${post.name} (try ${tries}): ${error.message}${hint(error.message)}`);
      }
      if (tries >= 3) {
        await store.setJSON(`missed/${post.name}`, { at: now.toISOString(), error: error.message });
      }
    }
  }
  if (problems.length && notify) await notify(problems);
  return log;
}

function hint(message) {
  if (/expired|session|OAuthException|access token|code":190|\(#190\)/i.test(message)) {
    return "\n  This usually means the Facebook key needs reconnecting (for example after a password change). See social/README.md, \"Reconnecting Facebook\".";
  }
  return "";
}

async function publish(post, { graph, readImage }) {
  if (post.kind === "photo") {
    const bytes = await readImage(post.images[0]);
    const result = await graph.upload("photos", bytes, post.images[0], { caption: post.message, published: "true" });
    return result.post_id || result.id;
  }
  if (post.kind === "photos") {
    const media = [];
    for (const image of post.images) {
      const result = await graph.upload("photos", await readImage(image), image, { published: "false" });
      media.push({ media_fbid: result.id });
    }
    const fields = { message: post.message };
    media.forEach((m, i) => { fields[`attached_media[${i}]`] = JSON.stringify(m); });
    return (await graph.post("feed", fields)).id;
  }
  if (post.kind === "link") {
    return (await graph.post("feed", { message: post.message, link: post.link })).id;
  }
  return (await graph.post("feed", { message: post.message })).id;
}

/* Calls Facebook's Pages API for one Page. `fetchImpl` is swappable for tests. */
export function graphClient({ pageId, token, version = "v25.0", fetchImpl = fetch }) {
  const base = `${GRAPH}/${version}/${pageId}`;
  async function call(edge, body) {
    const response = await fetchImpl(`${base}/${edge}`, { method: "POST", body });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) {
      const e = data.error || {};
      throw new Error(`${e.message || response.statusText || "unknown error"}${e.code ? ` (code ${e.code})` : ""}`);
    }
    return data;
  }
  return {
    post(edge, fields) {
      return call(edge, new URLSearchParams({ ...fields, access_token: token }));
    },
    upload(edge, bytes, filename, fields) {
      const form = new FormData();
      for (const [k, v] of Object.entries({ ...fields, access_token: token })) form.append(k, v);
      form.append("source", new Blob([bytes], { type: filename.endsWith(".jpg") || filename.endsWith(".jpeg") ? "image/jpeg" : "image/png" }), filename);
      return call(edge, form);
    },
  };
}
