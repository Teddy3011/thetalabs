# Theta Labs 3D website

Static site served by GitHub Pages at https://thetalab3d.shop/ (custom domain in `CNAME`).
There is no build step: whatever is committed to the default branch is what gets deployed.

```
index.html               the whole landing page (works without JavaScript)
privacy.html, terms.html legal pages (need owner/legal review, see below)
site.html                redirect stub for the old iframe URL
robots.txt, sitemap.xml
site.config.json         current values of business name, email, form URL, prices, …
scripts/set-config.mjs   changes one of those values everywhere (optional helper, never deployed logic)
assets/styles.css        all styles (colour/type/spacing tokens at the top)
assets/script.js         all enhancements: menu, intro, pricing switch, reveals, parallax, label decrypt
assets/                  images (WebP), blueprint.svg, og-image.png, fonts/
*.png (root)             original artwork, kept as source files; the site loads the WebP versions in assets/
```

## Local preview

```bash
python -m http.server 8000
```

Then open http://localhost:8000/. Add `?motion` (http://localhost:8000/?motion) to see the intro and all
animations on a computer that has reduced motion / Windows "Animation effects" turned off.

## Deployment

Commit and push to the branch GitHub Pages serves. Keep `CNAME` as is. No build, package install or workflow is needed.

## Updating the email, quote-form URL or prices

`site.config.json` records each value that appears on the site. To change one everywhere:

```bash
node scripts/set-config.mjs                       # list keys and current values
node scripts/set-config.mjs email new-address@thetalab3d.shop
node scripts/set-config.mjs quoteFormUrl "https://forms.gle/..."
node scripts/set-config.mjs priceUSMinimum '$20'
```

The script does a literal find-and-replace across the root `.html`, `.xml` and `.txt` files, prints how many
replacements it made per file, then updates `site.config.json`. Check the result with `git diff`.
It needs Node 18+ on your computer. Without Node, search the HTML files for the old value and replace it by hand:
the email is in `index.html`, `privacy.html` and `terms.html`; the form URL and prices are in `index.html` (`#pricing`, `#faq`, `#contact`).

Not covered by the script: the text baked into `assets/og-image.png` (regenerate it if the name or headline changes).

## Owner to-do list

Search the HTML for `OWNER-INPUT` to find every spot that needs a decision.

### 1. Google Form sign-in restriction (critical)
Signed out, the current Google Form returns HTTP 401 and a Google sign-in page (tested 2026-10-03).
The site says so next to the form button, and email is the primary call to action.
The usual causes are a **File upload** question (Google always requires sign-in for uploads), or the
*Restrict to users in [organisation]* / *Collect email addresses: Verified* settings.

Fix it in Google Forms (**Settings → Responses**):
1. Delete any **File upload** question. Ask people to email their STL/3MF files instead.
2. Turn off *Restrict to users in …* and set *Collect email addresses* to **Responder input** (not *Verified*).
3. Turn off *Limit to 1 response*, which also forces sign-in.
4. Test the form in a private/incognito window.
5. Once it opens without sign-in, delete the "The Google form may ask you to sign in…" note in `index.html` (`#contact`).

If you need anonymous file uploads, move the form to a service that supports them (for example Tally or Jotform),
then run `node scripts/set-config.mjs quoteFormUrl "<new url>"`.

### 2. Branded email
The site uses `info@thetalab3d.shop` (switched from the Gmail address on 2026-10-03).
Make sure it receives mail, ideally from an outside account, and that the old Gmail inbox forwards or is still watched while people update their contacts.

### 3. Google Search Console
1. Go to https://search.google.com/search-console, add a **Domain** property for `thetalab3d.shop`, and verify it with the DNS TXT record.
2. Open **Sitemaps** and submit `https://thetalab3d.shop/sitemap.xml`.
3. Use **URL inspection** on `https://thetalab3d.shop/` and request indexing.

### 4. Portfolio photos
"What we're built to print" (`#categories`) shows four print categories with line illustrations, because there are no
photos of real finished prints yet. They are labelled as categories, not past projects. When you have photos:
- 3–6 photos of real prints you have permission to show, 1600×1200 px or larger, plain dark or neutral background, sharp focus
- ideally one per category: an engineering prototype, a replacement component, a multicolor sign or label, an architecture/display model
- one sentence per photo: what it is, material, colors (this becomes the alt text)

Convert them to WebP, save them in `assets/work/`, and add them to `#categories` as
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
