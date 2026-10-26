# Tommy Stories website

The website for Tommy Stories, a monthly mailed booklet of true reader stories in large print.

Plain HTML and CSS with no build step. Netlify publishes the `site/` folder as-is. Checkout, billing and cancellations run on Stripe; story submissions use Netlify Forms.

## What's here

```
netlify.toml            Netlify settings (publish folder, security headers)
site/
  _redirects            Every Stripe link lives here (see "Stripe" below)
  index.html            Home page with the subscribe button
  gift/                 Gift subscriptions (3, 6, 12 months)
  gift/thanks/          Shown after a gift checkout
  share/                "Share your story" form (Netlify Forms)
  share/thanks/         Shown after a story is sent
  welcome/              Shown after a subscription checkout
  questions/            FAQ
  terms/  privacy/      DRAFT legal pages (have a lawyer review)
  404.html
  assets/styles.css     All styling
  assets/favicon.svg
```

Short links the site and printed issues use:

| Link | Goes to |
| --- | --- |
| `/join` | Stripe checkout for the $16.99 monthly subscription. **Use this for the QR code in every issue.** |
| `/gift/3`, `/gift/6`, `/gift/12` | Stripe checkout for prepaid gifts |
| `/manage` | Stripe customer portal (cancel, change address, update card) |

Because the printed QR code points to `/join` and not straight to Stripe, you can change the Stripe link later without reprinting anything.

## Placeholders to replace

Use find-and-replace across the `site/` folder.

| Find | Replace with |
| --- | --- |
| `tommystories.com` | Your domain (appears in `support@tommystories.com`) |
| `[PHONE]` | Phone number as readers should see it, e.g. (410) 555-0123 |
| `+1XXXXXXXXXX` | Same number for tap-to-call, digits only, e.g. +14105550123 |
| `[MAILING ADDRESS]` | Street line of your virtual address |
| `[CITY, STATE ZIP]` | City line of your virtual address |
| `REPLACE_..._LINK` in `site/_redirects` | Your Stripe links (next section) |

## Setup, in order

### 1. GitHub and Netlify

1. Push this folder to a GitHub repo.
2. In Netlify: **Add new project > Import an existing project**, pick the repo. Netlify reads `netlify.toml`, so leave the build command empty and the publish directory as `site`.
3. In the project's **Forms** settings, enable form detection, then redeploy so Netlify finds the story form.
4. Under **Forms > Form notifications**, add an email notification to your support address.

### 2. Stripe

Create these in Stripe (test mode first, then live):

| Product | Price | Payment Link settings |
| --- | --- | --- |
| Tommy Stories monthly | $16.99, recurring monthly | Collect shipping address (United States only), collect phone (optional). After payment, redirect to `https://YOURDOMAIN/welcome/` |
| Tommy Stories gift, 3 months | $50.97, one time | Collect shipping address (United States only); this is the recipient's address. Redirect to `https://YOURDOMAIN/gift/thanks/` |
| Tommy Stories gift, 6 months | $101.94, one time | Same as above |
| Tommy Stories gift, 12 months | $203.88, one time | Same as above |

Then:

1. Paste each Payment Link URL into `site/_redirects`.
2. **Settings > Billing > Customer portal**: allow canceling (at the end of the billing period), updating payment methods, and updating the shipping address. Copy the portal's login link into the `/manage` line of `site/_redirects`.
3. **Settings > Customer emails**: turn on receipts for successful payments.
4. Add your business address, phone, and links to `/terms/` and `/privacy/` in your Stripe account's public business details.

### 3. Domain and email

1. Buy the domain and add it to the Netlify project (**Domain management**).
2. In Zoho Mail, add the domain, verify it, and add Zoho's MX, SPF and DKIM records at your DNS host.
3. Create `support@yourdomain` (a new user or an alias, depending on your Zoho plan).

### 4. Before launch

- [ ] Replace every placeholder above
- [ ] Have a lawyer review `terms/`, `privacy/`, and the story-agreement checkbox on `share/`
- [ ] Run a full test checkout in Stripe test mode: subscribe, land on `/welcome/`, cancel in the portal
- [ ] Send a test story with a file attached and confirm the notification email arrives
- [ ] Scan a printed test QR code pointing to `https://YOURDOMAIN/join`

## Preview locally

```
python3 -m http.server 8000 --directory site
```

Then open http://localhost:8000. The `/join`, `/gift/*` and `/manage` links and the story form only work once deployed on Netlify (or with `netlify dev`).

## Later

- n8n workflow: Stripe events (new subscriber, cancellation, address change) update a subscriber list, send a welcome email from Zoho, and produce the monthly address CSV for the printer. Until then, export active subscriptions with shipping addresses from Stripe each month.
