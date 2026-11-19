/* Share with a friend: once a day, sends the one reminder to friends who
   were invited a week ago and haven't asked us to stop (netlify/lib/friend.mjs).

   Netlify runs this on the schedule below (10:00 a.m. Eastern in winter,
   11:00 in summer). Scheduled functions only run on the live site, not on
   previews. */
import { getStore } from "@netlify/blobs";
import { makeSender } from "../lib/mailer.mjs";
import { sendDueReminders } from "../lib/friend.mjs";

export default async () => {
  const send = makeSender();
  if (!send) {
    console.log("Friend reminders are off: add SMTP_USER and SMTP_PASS in Netlify.");
    return;
  }
  const store = getStore({ name: "friend-invites", consistency: "strong" });
  const sent = await sendDueReminders({ store, send, site: process.env.URL });
  console.log(`Friend reminders sent: ${sent}`);
};

export const config = {
  schedule: "0 15 * * *",
};
