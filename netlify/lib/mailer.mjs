/* Sends email through the support@ mailbox in Zoho, using the SMTP_USER and
   SMTP_PASS settings in Netlify (see the README, "Confirmation emails").
   Returns null until those are set, so nothing is sent. */
import nodemailer from "nodemailer";

export function makeSender() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;

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
  // A message can set fromName (the friend invitations use "Shane via Tommy
  // Stories"); the address is always the support@ mailbox.
  return ({ fromName, ...message }) =>
    transport.sendMail({ from: { name: fromName || "Tommy Stories", address: user }, ...message });
}
