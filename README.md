# Tommy Stories website

The website for Tommy Stories, a monthly mailed booklet of true reader stories in large print.

Plain HTML and CSS with no build step. Netlify publishes the top level of the repo as-is. Checkout, billing and cancellations run on Stripe; story submissions use Netlify Forms. One small Netlify function emails a confirmation to people who send a story or a letter.

## What's here

```
netlify.toml          Netlify settings (publish folder, security headers)
netlify/functions/    submission-created.mjs: the confirmation email (see
                      "Confirmation emails" below)
package.json          What that function needs (nodemailer); no build step
_redirects            Every Stripe link lives here (see "Stripe" below)
index.html            Home page with the subscribe button
gift/                 Gift subscriptions (6, 12, 24 months)
gift/thanks/          Shown after a gift checkout
share/                "Share your story" form (Netlify Forms)
share/thanks/         Shown after a story is sent
write/                "Write to Tommy" letter form (Netlify Forms), for Letters to Tommy
write/thanks/         Shown after a letter is sent
about/                "Who's Tommy Stories": the story behind Tommy Stories
welcome/              Shown after a subscription checkout
questions/            FAQ
order-form/           Printable order form for paying by check (one Letter page)
join/                 Plan choice page: monthly, yearly or gift (the QR code target)
terms/  privacy/      DRAFT legal pages (have a lawyer review)
404.html
assets/styles.css     All styling (navy #004185, antique gold #D4B06A / #A8833B)
assets/fonts/         Self-hosted fonts: Bodoni Moda (masthead and
                      headings), Yellowtail ("Stories" in the logo),
                      Libre Caslon Text (body), La Belle Aurore (the
                      handwritten letter). OFL, Yellowtail Apache 2.0.
assets/favicon.svg
```

Short links the site and printed issues use:

| Link | Goes to |
| --- | --- |
| `/join` | The plan choice page (monthly, yearly or gift). **Use this for the QR code in every issue.** |
| `/join/monthly`, `/join/yearly` | Stripe checkout for the $14.99 monthly and $169.99 yearly subscriptions |
| `/gift/6`, `/gift/12`, `/gift/24` | Stripe checkout for prepaid gifts of 6 months, 1 year and 2 years |
| `/manage` | Stripe customer portal (cancel, change address, update card) |

Because the printed QR code points to `/join` and not straight to Stripe, you can change a Stripe link later without reprinting anything.

## Placeholders to replace

Use find-and-replace across all the files.

| Find | Replace with |
| --- | --- |
| `tommystories.com` | Your domain (appears in `support@tommystories.com` and `tommy@tommystories.com`, the address for Letters to Tommy) |
| `REPLACE_..._LINK` in `_redirects` | Your Stripe links (next section) |

## Setup, in order

### 1. GitHub and Netlify

1. Push this folder to a GitHub repo.
2. In Netlify: **Add new project > Import an existing project**, pick the repo. Netlify reads `netlify.toml`, so leave the build command empty and the publish directory as `.`.
3. In the project's **Forms** settings, enable form detection, then redeploy so Netlify finds the story form.
4. Under **Forms > Form notifications**, add email notifications: the `story-submission` form to your support address, and the `letter-to-tommy` form to `tommy@yourdomain`.

### 2. Stripe

Create these in Stripe (test mode first, then live):

| Product | Price | Payment Link settings |
| --- | --- | --- |
| Tommy Stories monthly | $14.99, recurring monthly (was $16.99 until Nov 23, 2026) | Collect shipping address (United States only). Turn on **Require customers to accept your terms of service** (needs the `/terms/` link in your public business details). After payment, redirect to `https://YOURDOMAIN/welcome/` |
| Tommy Stories yearly | $169.99, recurring yearly (was $199.99 until Nov 23, 2026) | Same as monthly |
| Tommy Stories gift, 6 months | $99.99, one time | Collect shipping address (United States only); this is the recipient's address. Redirect to `https://YOURDOMAIN/gift/thanks/` |
| Tommy Stories gift, 1 year | $199.99, one time | Same as above |
| Tommy Stories gift, 2 years | $329.99, one time | Same as above |

Then:

1. Paste each Payment Link URL into `_redirects`.
2. **Settings > Billing > Customer portal**: allow canceling at the end of the billing period (not immediately; issues keep coming for the time already paid, and there are no refunds or prorations), updating payment methods, and updating the shipping address. Copy the portal's login link into the `/manage` line of `_redirects`.
3. **Customer emails** settings: turn on receipts for successful payments. Leave Stripe's **Send emails about upcoming renewals** off: it would email monthly subscribers too. Yearly subscribers in some states (California and New York, for example) must get a renewal reminder 15 to 45 days ahead, so build a yearly-only reminder email before the first yearly renewal. The site doesn't promise one.
4. Add your business address (3151 Cape Horn Rd, Unit #2079, Red Lion, PA 17356), support email, and links to `/terms/` and `/privacy/` in your Stripe account's public business details.

### 3. Domain and email

1. Buy the domain and add it to the Netlify project (**Domain management**).
2. In Zoho Mail, add the domain, verify it, and add Zoho's MX, SPF and DKIM records at your DNS host.
3. Create `support@yourdomain` and `tommy@yourdomain` (new users or aliases, depending on your Zoho plan).

### Confirmation emails

When someone sends a story or a letter and gives an email address, the site emails them a short confirmation from `support@`: thanks, the date it arrived, how their name will be printed, and what happens next. It never repeats what they wrote. Replies to a story confirmation go to `support@`; replies to a letter confirmation go to `tommy@`.

The email is sent by `netlify/functions/submission-created.mjs`, which Netlify runs on its own after each form submission that passes its spam check. It sends through your Zoho mailbox, so it needs two settings:

1. In Zoho, sign in as `support@`, go to **My Account > Security > App Passwords**, and create one named "Website". Copy it.
2. In Netlify: **Project configuration > Environment variables > Add a variable**:
   - `SMTP_USER` = `support@tommystories.com`
   - `SMTP_PASS` = the app password from step 1
   - Only if your Zoho account isn't in the U.S. data center: `SMTP_HOST` = `smtppro.zoho.eu` (or `.in`, `.com.au`). The default is `smtppro.zoho.com`.
3. **Deploys > Trigger deploy > Deploy project** so the function picks up the settings.
4. Send yourself a test story and a test letter.

Until both settings are added, no confirmation is sent and the forms work as before. If a test email doesn't arrive, look under **Logs > Functions > submission-created**: "Invalid login" or "Authentication failed" means the app password or the Zoho plan is the problem (Zoho's free plan may not allow sending from outside apps; Mail Lite does).

### 4. Before launch

- [ ] Replace every placeholder above
- [ ] Have a lawyer review `terms/`, `privacy/`, and the story-agreement checkbox on `share/`
- [ ] Run a full test checkout in Stripe test mode: subscribe, land on `/welcome/`, cancel in the portal
- [ ] Send a test story with a file and 2 phone photos attached and confirm the notification email arrives with all three
- [ ] Confirm the reader's confirmation email arrives for a test story and a test letter (and isn't in spam)
- [ ] Scan a printed test QR code pointing to `https://YOURDOMAIN/join`

### Share with a friend

Readers can invite up to 10 friends at a time at `/friend/`, with a short note (required, and signed by the reader: it's how friends know who the invitation is from). We email each friend one invitation from `support@` with the note and a link to their invitation page, email the reader one copy listing who was invited, and send each friend one reminder a week later. Every email to a friend has a "Stop all emails" link.

The friend's emails are plain letters that name nobody ("A friend referred you to Tommy Stories"), with no prices, no buttons and one link ("Open your invitation"), so they read like a note from a friend and are less likely to land in Gmail's Promotions tab. (Gmail decides on its own, so there's no guarantee.) The price and terms are on the invitation page, `/friend/invitation/`: not linked anywhere on the site and kept out of search engines, it shows the friend offer ($12.99 a month for the first 3 months on the Monthly plan) and its Start my subscription button goes to `/join/friend`. Visits show in Google Analytics under that page.

An address can be invited more than once (each invitation brings its own one reminder), except addresses that used the stop link, which we never email again. To test, send invitations to your own Gmail from a different "your email" (the form won't send to the reader's own address).

The pieces:

- `friend/invitation/`: the page the invitation links to, with the friend's rate.
- `friend/index.html` and `friend/thanks/`: the form (a Netlify form named `share-with-a-friend`; submissions show under **Forms** in Netlify).
- `netlify/lib/friend.mjs`: the emails and the rules (stop requests honored forever; at most 10 invitations a day from one reader; notes are plain text with no web addresses). The offer price is set at the top of this file (it appears in the reader's copy), and also written on the invitation page, the friend page, Questions, the welcome page and Terms.
- `netlify/functions/submission-created.mjs`: sends the invitation when the form comes in.
- `netlify/functions/friend-reminders.mjs`: runs every day at 15:00 UTC and sends the week-later reminders.
- `netlify/functions/friend-stop.mjs`: the stop link, at `/friend/stop`.
- What we remember between emails is kept in Netlify Blobs (store `friend-invites`); nothing to set up.
- The emails use the same `SMTP_USER` and `SMTP_PASS` settings as the confirmation emails.

Set up the offer in Stripe (live mode) before sharing the page:

1. **Product catalog > Coupons > Create coupon**: name "Friend offer", **Amount off** $4.00, duration **Multiple months**, 3 months, applied only to the Tommy Stories monthly product.
2. On that coupon, **Add promotion code**: `TOMMYFRIEND`, and check **Eligible for first-time order only**.
3. **Payment Links**: open the Monthly link, edit it, turn on **Allow promotion codes**, and save.
4. Open `https://tommystories.com/join/friend`: the checkout should show `TOMMYFRIEND` applied and $10.99.

`/join/friend` in `_redirects` holds the code. If you change the code in Stripe, change it there too.

## Reviews

Reader reviews live in one file, `assets/reviews.json`, and show in the carousels on the Subscribe page and the gift page. Each review has a `label` ("Gave it as a gift", "Shared it with family", "Reader" or, once they subscribe, "Subscriber"), the `quote` in the reader's own words, the `name` (first name and last initial) and, optionally, a `place` ("Town, ST"). If the file is ever emptied, the carousels hide themselves.

Rules for what goes in it:

- **Real readers only**, in their own words. Trim for length if needed, but never change the meaning, and never write or "improve" a review yourself.
- **Get permission in writing** (an email reply is fine) to quote them with their first name and last initial. Keep that email.
- **Disclose any connection.** Reviews from friends, family, or anyone who got a free issue need to say so. The line under each carousel ("From friends who subscribe.") covers the first five reviewers. Keep it while any of their reviews are showing; drop it once every review shown comes from subscribers you don't know personally.
- Don't use reviews of other publications, and don't show only the glowing ones if you've received critical ones on the same point.

## Link previews

When someone shares a page on Facebook, in a text message or in an email, the preview shows `assets/share-preview.png` (1200 x 630, the Facebook cover design) with the page's title and description. Those come from the `og:` lines near the top of each page. To change the picture, replace that file and keep the same name; Facebook keeps its old copy for a while, so paste the page address into Facebook's Sharing Debugger (developers.facebook.com/tools/debug) and press **Scrape Again**. The picture is made in the booklet workspace (`social/make_social.py`).

## Story pages for Facebook

Each Facebook story post tells the first half of a story and links to the
rest on our site, where the full story is followed by what Tommy Stories is
and how to subscribe or give it as a gift.

- **Pages:** `stories/<slug>/` (made by `tools/build_stories.py`; don't edit
  them by hand). Not linked anywhere on the site and marked `noindex`, so
  search engines leave them out. Each has the full story in large print, one
  optional photo, a "You left off on Facebook here" marker with a "Skip to
  where you left off" link, the offer (booklet picture, what's inside,
  prices, Start my subscription, Give it as a gift), Share your story, and
  Share on Facebook / Copy the link. On phones, a Subscribe / Give a gift
  bar stays at the bottom while reading (`assets/story.js`).
- **Links to post:** `tommystories.com/s/<slug>`. Each opens the story with
  `utm_source=facebook&utm_medium=social&utm_campaign=<slug>` (the
  `_redirects` block between the "story links" lines is rewritten by the
  build script).
- **Story files:** `stories/_src/<slug>.txt`, photos in `stories/_src/images/`
  (format in `stories/_src/README.md`; not served on the website).
- **Build:** `python3 tools/build_stories.py` (needs Pillow for photos), then
  commit the story file, photo, page and `_redirects`.
- **Daily routine:** the owner sends the day's full stories (a PDF: each
  story starting on a new page, title first, a line with `~~~` where the
  Facebook post stops, and the photo if there is one). Claude checks the
  facts, writes the story files, builds, opens a pull request and sends back
  each story's `/s/` link.
- **Photos:** only ones we have the right to use (our own, a reader's with
  permission, or licensed). Not photos copied from TV, news sites or other
  Pages.
- **Google Analytics:** visits by story are under Traffic acquisition with
  **Session campaign** (the slug). Reaching the end of a story sends the
  event `story_finished` with a `story` parameter (to break it down by
  story, add `story` as an event-scoped custom dimension under Admin >
  Custom definitions).

## Email signature logo

`assets/email/signature-logo.png` (440 x 136, shown at 220 x 68) is the logo in the Zoho Mail email signatures. Email signatures load it from https://tommystories.com/assets/email/signature-logo.png, so keep that file at that address: moving or renaming it breaks the logo in every email already sent.

## Google Analytics

Every page has Google's tag (gtag.js) for the Google Analytics property tommystories.com, Measurement ID `G-FNPRVNVL46`, near the top of its `<head>`. A new page needs the same lines (copy them from any page). To switch to a different property, find and replace the ID on every page.

Checkout happens on Stripe's site, where the tag can't run, so the thank-you pages report what happened:

- `welcome/` sends `subscribed` (Monthly, Yearly and the friend offer all land here)
- `gift/thanks/` sends `gift_purchased`
- `friend/thanks/` sends `friends_invited`

Each is a **key event** in Google Analytics (Admin > Data display > Key events), so the reports count them. Stripe is on the property's list of unwanted referrals (Admin > Data streams > the web stream > Configure tag settings > List unwanted referrals), so a subscriber is credited to wherever they came from (Facebook, a search) rather than to Stripe.

The Privacy page's "Website visits" section describes this and says we don't use it to show ads: keep Google signals and other advertising features off unless that section is updated first. Don't add the tag to the `/friend/stop` page (made by a function): its address carries a friend's stop code.

## Browser caching

Every page links to `styles.css`, `reviews.js` and `share.js` with a version tag (for example `styles.css?v=20261028`). Browsers check for new copies of these files on each visit, but if a style change ever seems stuck for someone, change the tag on every page (find and replace) to force a fresh download. Fonts are cached for a year, since their files never change.

## Preview locally

```
python3 -m http.server 8000 --directory .
```

Then open http://localhost:8000. The `/join`, `/gift/*` and `/manage` links and the story form only work once deployed on Netlify (or with `netlify dev`).

## Later

- n8n workflow: Stripe events (new subscriber, cancellation, address change) update a subscriber list, send a welcome email from Zoho, and produce the monthly address CSV for the printer. Until then, export active subscriptions with shipping addresses from Stripe each month.
