/* Facebook posts: every 15 minutes, publishes any approved post from
   social/posts/ whose time has come (netlify/lib/facebook.mjs explains the
   details, and social/README.md the post format and setup).

   Needs two settings in Netlify (Project configuration > Environment
   variables): FB_PAGE_ID and FB_PAGE_TOKEN. Until they're set, it only logs
   what it would post. Problems are emailed to support@ through the same
   SMTP_USER and SMTP_PASS settings as the confirmation emails.

   The post files ride along with this function (netlify.toml,
   included_files); they aren't served on the public website. */
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getStore } from "@netlify/blobs";
import { makeSender } from "../lib/mailer.mjs";
import { graphClient, postDue, upcoming } from "../lib/facebook.mjs";

function postsFolder() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), "social/posts"),
    process.env.LAMBDA_TASK_ROOT && path.resolve(process.env.LAMBDA_TASK_ROOT, "social/posts"),
    path.resolve(here, "../../social/posts"),
    path.resolve(here, "../social/posts"),
  ].filter(Boolean);
  return candidates.find((dir) => existsSync(dir));
}

export default async () => {
  const folder = postsFolder();
  if (!folder) {
    console.error("Facebook posts: can't find the social/posts folder (check included_files in netlify.toml).");
    return;
  }
  const names = (await readdir(folder)).filter((n) => n.endsWith(".md") && !n.startsWith("_") && n.toLowerCase() !== "readme.md");
  const files = await Promise.all(names.map(async (name) => ({ name, source: await readFile(path.join(folder, name), "utf8") })));

  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_TOKEN;
  const graph = pageId && token ? graphClient({ pageId, token, version: process.env.FB_GRAPH_VERSION || "v25.0" }) : null;

  const send = makeSender();
  const notify = send
    ? (problems) => send({
        to: process.env.SMTP_USER,
        subject: "Tommy Stories: a Facebook post needs a look",
        text: `The Facebook posting robot ran into ${problems.length === 1 ? "a problem" : "some problems"}:\n\n${problems.map((p) => `- ${p}`).join("\n\n")}\n\nThe posts are in social/posts/ in the website repository. Nothing else needs doing if a post is simply no longer wanted.`,
      })
    : null;

  const store = getStore({ name: "facebook-posts", consistency: "strong" });
  const log = await postDue({
    files,
    readImage: (image) => readFile(path.join(folder, "images", path.basename(image))),
    store,
    graph,
    notify,
  });
  log.push(upcoming(files));
  if (!graph) log.push("Facebook isn't connected yet (FB_PAGE_ID and FB_PAGE_TOKEN), so nothing is posted.");
  console.log(`Facebook posts:\n${log.join("\n")}`);
};

export const config = {
  schedule: "*/15 * * * *",
};
