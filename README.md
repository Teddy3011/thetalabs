# Theta Labs 3D website

Static site served by GitHub Pages at https://thetalab3d.shop/ (custom domain in `CNAME`).
There is no build step: whatever is committed to the default branch is what gets deployed.

```
index.html               the whole landing page (works without JavaScript)
privacy.html, terms.html legal pages (need owner/legal review, see below)
site.html                redirect stub for the old iframe URL
robots.txt, sitemap.xml
site.config.json         current values of business name, email, prices, turnaround, pickup area, …
scripts/set-config.mjs   changes one of those values everywhere (optional helper, never deployed logic)
assets/styles.css        all styles (colour/type/spacing tokens at the top)
assets/script.js         all enhancements: menu, intro, pricing switch, reveals, parallax, label decrypt
assets/home.css          "Ideas become objects" design language: shared tokens first, then the homepage sections
assets/estimate.css      estimate page: job-ticket steps, option buttons, live price, estimate slip and its printer
assets/receipt.js        estimate-slip printer (paper feed, tear-off). Decorates a slip that is already plain text on the page
assets/home.js           homepage-only: draws the layer-by-layer objects on canvas (hero demo, gallery, process)
assets/                  images (WebP), blueprint.svg, og-image.png, fonts/ (Space Grotesk, Space Mono, Fraunces: all SIL OFL, licences beside them)
*.png (root)             original artwork, kept as source files; the site loads the WebP versions in assets/
```

## Accounts, orders and the printer marketplace (Supabase)

```
estimate.html            STL estimate in the browser; signed-in customers place orders (file → private storage)
account.html             My orders, live status
track.html?id=…          one order, live status
printers.html            printer owners: apply, then accept jobs / download / start / ready / picked up
admin.html               approve printers, all orders + status, pricing and payout settings
login.html, signup.html
assets/config.js         Supabase project URL + anon key (public)
assets/app.js            shared client code; assets/stl.js STL math + pricing (tested by `npm test`)
supabase/schema.sql      tables, RLS, job functions, storage bucket — run once in the SQL editor
supabase/002_*.sql       later changes (materials, colors) — run after schema.sql, in order
supabase/003_*.sql       guest accounts: guests are always customers, at most 10 parts in progress, email sync
supabase/004_*.sql       cart + payment: quote → priced → open, set_final_price, pay_on_pickup, mark_cart_paid
supabase/functions/      create-checkout (opens Stripe Checkout) and stripe-webhook (marks a cart paid)
cart.html, bill.html     cart (files kept in the browser until checkout) and the order page: bill, payment, live status
assets/cart.js           the cart (IndexedDB)   assets/bill.js  order stage + receipt lines (tested by npm test)
assets/avatar.js         a guest's face (DiceBear "Lorelei", CC0, loaded from api.dicebear.com) and isotope name ("Carbon-13"), from the account id
```

Until `assets/config.js` has real values, those pages show a "Preview · not live yet" notice and the estimator still works.

### Setup checklist
1. Create a free project at https://supabase.com (pick the region closest to Tempe, e.g. West US).
2. **SQL Editor → New query**: paste all of `supabase/schema.sql`, click **Run**. Then do the same with
   `supabase/002_materials_colors.sql` (materials and color choices; run it even if you set up the database earlier).
3. **Project Settings → API**: copy the **Project URL** and the **anon public** key into `assets/config.js`.
   Never use the `service_role` key on the site.
4. **Authentication → URL Configuration**: Site URL `https://thetalab3d.shop`; add redirect URLs
   `https://thetalab3d.shop/login.html` and `http://localhost:8000/login.html`.
5. **Authentication → Emails**: the built-in sender only sends a few emails per hour. Before real customers sign up,
   add your own SMTP (e.g. Resend, Brevo, or your mail provider) under **SMTP Settings**.
6. Sign up on the site with `info@thetalab3d.shop`, confirm the email, then in the SQL editor run
   `update public.profiles set role = 'admin' where email = 'info@thetalab3d.shop';`
7. **Guest checkout (optional):** run `supabase/003_guest_accounts.sql`, then turn on
   **Authentication → Sign In / Providers → Allow anonymous sign-ins**. Customers can then press
   "Continue as guest" when placing an order: no email or password, a random avatar and name, orders tracked in that
   browser. Guests can add an email later on My orders to keep the account. Without this setting the button shows a
   "not available" message and customers log in as before. If guests start creating lots of accounts, turn on
   **Authentication → Bot and abuse protection (CAPTCHA)**.
8. **Cart and payments:** run `supabase/004_cart_payments.sql`. Orders now wait as quotes: open **admin.html**,
   enter each part's final price and press **Set price**. When every part in a cart is priced, the customer's order
   page offers **Pay on pickup**, and **Pay by card** once Stripe is set up (next step). Printers only see a job after
   it is paid or set to pay on pickup.
9. **Card payments (Stripe, USD only):** install the Supabase CLI, then, logged in to your project:
   ```bash
   supabase functions deploy create-checkout
   supabase functions deploy stripe-webhook --no-verify-jwt
   supabase secrets set STRIPE_SECRET_KEY=sk_... SITE_URL=https://thetalab3d.shop
   ```
   In Stripe → Developers → Webhooks, add an endpoint `https://<project>.supabase.co/functions/v1/stripe-webhook`
   for the event `checkout.session.completed`, copy its signing secret and run
   `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`. Finally set `CARD_PAYMENTS = true` in `assets/config.js`.
   Use Stripe's test keys first (card 4242 4242 4242 4242), then swap to live keys. Keys only ever go into
   `supabase secrets`, never into the site's files.
10. Test: sign up a second account as a printer, approve it on `admin.html`, place an order from a third account,
   accept it as the printer.

Notes: the free plan caps uploads at 50 MB per file, so the bucket limit is 50 MB (60 MB needs the Pro plan; see the
comment in `schema.sql`). Payments are not online yet: customers are told we confirm the price and they pay on pickup
or by invoice. Stripe Checkout is the planned next step. Free projects pause after a week with no activity.

## Local preview

```bash
python -m http.server 8000
```

Then open http://localhost:8000/. Add `?motion` (http://localhost:8000/?motion) to see the intro and all
animations on a computer that has reduced motion / Windows "Animation effects" turned off.

## Deployment

Commit and push to the branch GitHub Pages serves. Keep `CNAME` as is. No build, package install or workflow is needed.

## Updating the email or prices

`site.config.json` records each value that appears on the site. To change one everywhere:

```bash
node scripts/set-config.mjs                       # list keys and current values
node scripts/set-config.mjs email new-address@thetalab3d.shop
node scripts/set-config.mjs priceUSMinimum '$20'
```

The script does a literal find-and-replace across the root `.html`, `.xml` and `.txt` files, prints how many
replacements it made per file, then updates `site.config.json`. Check the result with `git diff`.
It needs Node 18+ on your computer. Without Node, search the HTML files for the old value and replace it by hand:
the email is in `index.html`, `privacy.html` and `terms.html`; prices are in `index.html` (`#pricing`, `#faq`); turnaround and pickup area are in `index.html`, `estimate.html` and `track.html`.

Not covered by the script: the text baked into `assets/og-image.png` (regenerate it if the name or headline changes).

## Owner to-do list

Search the HTML for `OWNER-INPUT` to find every spot that needs a decision.

### 1. Quote form
The Google Form link was removed on 2026-10-22: signed out, it returned HTTP 401 (a Google sign-in page).
The estimate page and email are the ways to order. If you bring back a form, use one that allows anonymous
file uploads (for example Tally or Jotform) and add it to `#contact` in `index.html`.

### 2. Branded email
The site uses `info@thetalab3d.shop` (switched from the Gmail address on 2026-10-03).
Make sure it receives mail, ideally from an outside account, and that the old Gmail inbox forwards or is still watched while people update their contacts.

### 3. Google Search Console
1. Go to https://search.google.com/search-console, add a **Domain** property for `thetalab3d.shop`, and verify it with the DNS TXT record.
2. Open **Sitemaps** and submit `https://thetalab3d.shop/sitemap.xml`.
3. Use **URL inspection** on `https://thetalab3d.shop/` and request indexing.

### 4. Portfolio photos
There are no photos of real finished prints yet; the Services cards (`#services`) use icons. When you have photos:
- 3–6 photos of real prints you have permission to show, 1600×1200 px or larger, plain dark or neutral background, sharp focus
- ideally one per service: a prototype, a custom part, a multicolor print, a display model
- one sentence per photo: what it is, material, colors (this becomes the alt text)

Convert them to WebP, save them in `assets/work/`, and add them to the matching Services card (`#services`) as
`<img src="assets/work/NAME.webp" alt="..." width="1600" height="1200" loading="lazy" decoding="async">`.

### 5. Privacy and terms: review required
`privacy.html` and `terms.html` follow the points in the project brief. They are not legal advice.
Have them reviewed (by you, and ideally a qualified adviser) before relying on them, especially for orders in India.

### 6. Facts to confirm
- Founder's public name, to add to the structured data in `index.html` (`OWNER-INPUT` comment in `<head>`)
- Whether shipping is offered, and where (FAQ "Do you ship orders?")
- Whether you help with modelling when there is no CAD file, and how it's priced (FAQ)
- Materials other than standard PLA, if any

## Notes
- **Brand:** "Theta Labs 3D". The domain stays `thetalab3d.shop`.
- **Intro:** first visit per browser session only, 2.9 s, with a "Skip intro" button (any key, click, tap or scroll also skips).
  Never plays with reduced motion or when the URL has a `#section`. The printed logo flies into the header logo at the end.
- **Motion:** everything animated is gated by `html.motion`, set in `<head>` unless the visitor prefers reduced motion.
  Without JavaScript or with reduced motion, every element is visible and static.
- **Header:** transparent at the top, blurred and bordered after scrolling, with a scroll progress line
  (CSS scroll-driven animations; browsers without support show a solid header and no progress line).
- **Menu:** staggered off-canvas menu at every screen size (vanilla port of React Bits StaggeredMenu).
  Without JavaScript the nav is a plain list of links in the header.
- **FAQ:** native `<details>`; the smooth open uses CSS `::details-content` (Chromium 131+, other browsers open instantly).
- **Fonts:** Space Grotesk and Space Mono, self-hosted under the SIL Open Font License (licences in `assets/fonts/`).
- `favicon-16.png`, `favicon-32.png` and `favicon-192.png` are not referenced by any page; harmless to keep.

## Receipt printer (estimate page)

The slip at the end of the estimate page is plain HTML built from the live estimate. `assets/receipt.js` adds the
printer, the paper feed and the tear-off; without it (or with reduced motion) the slip is simply shown.

It is a native stand-in for **React Bits Pro's Receipt Printer**, which could not be installed because:

1. it needs a licence key (`REACTBITS_LICENSE_KEY`), which is not set on this machine, and
2. it is a React component installed through the shadcn CLI, and this site has no React, no `package.json`
   dependencies and no build step (GitHub Pages serves the committed files as they are).

To swap it in later, without rebuilding the site:

1. Make a small React project in a subfolder, for example `islands/receipt/` (Vite + React), and run
   `npx shadcn@latest init` there so it has a `components.json`.
2. Put the key in `islands/receipt/.env.local` as `REACTBITS_LICENSE_KEY=...`. Never commit that file and never
   reference the key from site code: it is only read by the CLI at install time.
3. Add the two registries (`@reactbits-starter`, `@reactbits-pro`) to `components.json` exactly as shown at
   https://pro.reactbits.dev/docs/installation (the header reads the key from the environment variable).
4. `npx shadcn@latest add @reactbits-starter/receipt-printer-tw` (Tailwind), or `receipt-printer-css` for the
   plain-CSS variant, which avoids adding Tailwind.
5. Build it as one script (`vite build` in library mode) into `assets/receipt-island.js` and commit that file, so
   GitHub Pages still needs no build.
6. In `estimate.html`, mount it in `#printer` and pass the same data the slip uses now: the component's `lines`
   prop takes title / text / row / divider lines, which is the shape `render()` already builds. Use
   `autoplay={false}`, `barcode={false}`, `tax={0}`, and `paperColor="#efeadd"`. Keep the current slip as the
   fallback for when the script fails to load.
