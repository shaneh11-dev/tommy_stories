# Tommy Stories website

The website for Tommy Stories, a monthly mailed booklet of true reader stories in large print.

Plain HTML and CSS with no build step. Netlify publishes the top level of the repo as-is. Checkout, billing and cancellations run on Stripe; story submissions use Netlify Forms.

## What's here

```
netlify.toml          Netlify settings (publish folder, security headers)
_redirects            Every Stripe link lives here (see "Stripe" below)
index.html            Home page with the subscribe button
gift/                 Gift subscriptions (3, 6, 12 months)
gift/thanks/          Shown after a gift checkout
share/                "Share your story" form (Netlify Forms)
share/thanks/         Shown after a story is sent
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
| `/join/monthly`, `/join/yearly` | Stripe checkout for the $16.99 monthly and $199.99 yearly subscriptions |
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
4. Under **Forms > Form notifications**, add an email notification to your support address.

### 2. Stripe

Create these in Stripe (test mode first, then live):

| Product | Price | Payment Link settings |
| --- | --- | --- |
| Tommy Stories monthly | $16.99, recurring monthly | Collect shipping address (United States only). Turn on **Require customers to accept your terms of service** (needs the `/terms/` link in your public business details). After payment, redirect to `https://YOURDOMAIN/welcome/` |
| Tommy Stories yearly | $199.99, recurring yearly | Same as monthly |
| Tommy Stories gift, 6 months | $99.99, one time | Collect shipping address (United States only); this is the recipient's address. Redirect to `https://YOURDOMAIN/gift/thanks/` |
| Tommy Stories gift, 1 year | $199.99, one time | Same as above |
| Tommy Stories gift, 2 years | $329.99, one time | Same as above |

Then:

1. Paste each Payment Link URL into `_redirects`.
2. **Settings > Billing > Customer portal**: allow canceling at the end of the billing period (not immediately; issues keep coming for the time already paid, and there are no refunds or prorations), updating payment methods, and updating the shipping address. Copy the portal's login link into the `/manage` line of `_redirects`.
3. **Customer emails** settings: turn on receipts for successful payments, and turn on **Send emails about upcoming renewals**, with the reminder set to 30 days before renewal (under **Prevent failed payments > Upcoming renewal events**). The site promises yearly subscribers a reminder about 30 days ahead.
4. Add your business address (3151 Cape Horn Rd, Unit #2079, Red Lion, PA 17356), support email, and links to `/terms/` and `/privacy/` in your Stripe account's public business details.

### 3. Domain and email

1. Buy the domain and add it to the Netlify project (**Domain management**).
2. In Zoho Mail, add the domain, verify it, and add Zoho's MX, SPF and DKIM records at your DNS host.
3. Create `support@yourdomain` and `tommy@yourdomain` (new users or aliases, depending on your Zoho plan).

### 4. Before launch

- [ ] Replace every placeholder above
- [ ] Have a lawyer review `terms/`, `privacy/`, and the story-agreement checkbox on `share/`
- [ ] Run a full test checkout in Stripe test mode: subscribe, land on `/welcome/`, cancel in the portal
- [ ] Send a test story with a file attached and confirm the notification email arrives
- [ ] Scan a printed test QR code pointing to `https://YOURDOMAIN/join`

## Reviews

The Subscribe page (`join/index.html`) has a reviews carousel that stays hidden until it has real reviews. Rules for what goes in it:

- **Real readers only**, in their own words. Trim for length if needed, but never change the meaning, and never write or "improve" a review yourself.
- **Get permission in writing** (an email reply is fine) to quote them with their first name, last initial and town. Keep that email.
- **Disclose anything they got for free.** If a reader got a free preview issue, add "Received a free preview issue" under their name.
- Don't use reviews of other publications, and don't show only the glowing ones if you've received critical ones on the same point.

To add one, copy the example block inside the comment in the reviews section, fill it in, and once there are at least three, delete the word `hidden` from the `<section>` tag.

## Preview locally

```
python3 -m http.server 8000 --directory .
```

Then open http://localhost:8000. The `/join`, `/gift/*` and `/manage` links and the story form only work once deployed on Netlify (or with `netlify dev`).

## Later

- n8n workflow: Stripe events (new subscriber, cancellation, address change) update a subscriber list, send a welcome email from Zoho, and produce the monthly address CSV for the printer. Until then, export active subscriptions with shipping addresses from Stripe each month.
