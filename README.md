# The Stampede Ranch — Website Re-Design

Front-end build for the re-design of **stampederanch.ca**, produced by Digital
Marketing Collective. This repository holds the Round 1 static build: a complete,
responsive, production-quality front end that is reviewed as HTML and then carried
into WordPress + Elementor for Phase 1 launch.

**Design source:** Figma — *Stampede Ranch — Homepage Concepts*, Concept 01
"Cinematic Ranch Luxury" (approved direction).
**Reference:** pawsup.com · hoteldrover.com
**Phase 1 target:** September 7, 2026

---

## Pages

| File | Page | Notes |
|---|---|---|
| `index.html` | Home | Cinematic video hero, story teaser, experience grid, timeline, renderings, aerial strip, shop teaser, CTA |
| `venues.html` | Venues & Events | Nine venue cards, stats band, events breakdown, availability/booking form |
| `weddings.html` | Weddings | Full-ranch buyout narrative, three-day weekend timeline, inclusions, wedding inquiry form |
| `history.html` | Our History | Scroll-driven era chapters — Minesinger, Weadick & LaDue, Edey, Today |
| `contact.html` | Plan Your Visit | Contact details, general inquiry form, FAQ accordion |

Shop (WooCommerce) and the Journal / press section are Phase 2 and are represented
here only as teasers.

---

## Structure

```
/
├── index.html · venues.html · weddings.html · history.html · contact.html
├── favicon.png
└── assets/
    ├── css/
    │   ├── fonts.css     @font-face declarations (self-hosted)
    │   └── main.css      design tokens + all component styles
    ├── js/
    │   └── main.js       menu, scroll reveal, hero video, form handling
    ├── fonts/            Fraunces + Work Sans (woff2, latin subset)
    ├── img/              responsive WebP + JPEG derivatives
    ├── logo/             brand lockup, bronc mark, wordmark, icons, share image
    └── video/            hero reel (MP4, two sizes) and poster frame
```

No build step, no dependencies. Open `index.html` or serve the folder:

```bash
python3 -m http.server 8000
```

---

## Design system

All design decisions live as CSS custom properties at the top of `main.css`, mapped
directly from the Figma variable collection *Stampede Ranch Palette*.

| Token | Value | Use |
|---|---|---|
| `--rust` | `#a6522c` | Brand accent, large text, decoration |
| `--rust-text` | `#8f4523` | Small text on light backgrounds (AA at 11px) |
| `--rust-deep` | `#7a3b1f` | Hover states |
| `--sage` / `--sage-deep` | `#78876e` / `#454f3b` | Secondary surfaces |
| `--gold` / `--gold-light` | `#c9a227` / `#e4c976` | Primary CTA, eyebrows on dark |
| `--charcoal` / `--charcoal-deep` | `#211d18` / `#151210` | Dark sections, nav rail |
| `--cream` / `--cream-deep` | `#f4efe4` / `#e7dfcd` | Page and alternating section backgrounds |

Type: **Fraunces** (display) + **Work Sans** (body), self-hosted. Headings and the
hero scale fluidly with `clamp()`, so there are no fixed breakpoint jumps in type size.

Breakpoints: `1080px` (grid reflow), `860px` (rail → mobile top bar), `560px` (single column).

---

## Notable implementation details

**Side navigation.** A fixed 96px charcoal rail on desktop, per Concept 01. Below
860px it becomes a top bar. Both open the same full-screen overlay menu; the menu
traps nothing but moves focus to its first link, closes on `Escape`, restores focus
to the trigger, and locks body scroll while open.

**Hero video.** The 1280 cut loads by default; `main.js` swaps in the 1920 cut on
viewports ≥1100px unless the browser reports Save-Data or a 2g/3g connection. The reel
ships as H.264 MP4 — VP9/WebM was trialled and came out no smaller on this high-motion
aerial footage. A visible play/pause control sits over the hero, and under `prefers-reduced-motion` the video never autoplays — the
poster frame stands in.

**Brand marks.** The supplied logo files are a single integrated lockup (script
wordmark overlapping the bucking-horse illustration), so they were separated
programmatically by connected-component analysis into three reusable assets in each
tone — full lockup, bronc mark alone, and script wordmark alone:

| Asset | Where it's used |
|---|---|
| `logo-mark-white-h96/h192` | Desktop nav rail, mobile top bar |
| `logo-wordmark-white-320/640` | Mobile top bar (legible where the lockup would be too small) |
| `logo-lockup-white-260/520` | Footer, overlay menu |
| `logo-mark-rust-h96/h192` | Section-opening brand device on cream backgrounds |
| `logo-lockup-rust-260/520` | Available for light-background and print use |
| `favicon.png`, `apple-touch-icon.png`, `mark-512.png` | White bronc on charcoal |
| `og-image.jpg` | 1200×630 share card — hero frame, scrim, white lockup |

Each placement serves a 1x and 2x file via `srcset`. The rail and top-bar marks carry
the accessible name; the decorative repeats use empty `alt` so screen readers hear the
ranch name once per page.

**Images.** Every photograph ships as WebP with a JPEG fallback at 640/1280/1920,
wired through `<picture>` with `sizes`. Everything below the fold is lazy-loaded and
carries intrinsic `width`/`height` to prevent layout shift.

**Motion.** Scroll reveals use `IntersectionObserver` and are disabled outright under
`prefers-reduced-motion`, which also short-circuits the marquee animation and smooth
scrolling.

**Forms.** All three inquiry forms are wired to a prototype handler that validates and
confirms inline without sending anything. Field names are already shaped for the real
integration.

---

## Accessibility

Audited with axe-core against WCAG 2.1 A/AA at 1440px: **0 violations on all five pages.**

Also verified by hand: skip link is the first tab stop, focus is visible throughout,
the menu is keyboard operable, form fields are labelled, decorative images carry empty
`alt`, and no page overflows horizontally at 390px.

---

## Content still to source

- **Interior photography at full resolution.** The interior shots on the shared drive
  are 480–1024px compressed copies. They hold up in cards but not full-bleed. Originals
  or a fresh shoot are needed before launch.
- **Archival imagery** for the Weadick & LaDue era on `history.html` (Glenbow Archives
  or the family collection) — currently a marked placeholder.
- **Venue capacities**, listed as planning estimates, to be confirmed with the ranch.
- **Phone and email** for the contact page.
- **A professionally cut hero reel.** The current reel is a single 17-second drone shot
  from October 2023, colour-corrected and compressed from the source footage.

---

## Carrying this into WordPress + Elementor

- Self-host the fonts in `assets/fonts/` rather than enqueuing Google Fonts.
- Register the tokens in `main.css` as Elementor Global Colors and Global Fonts so the
  ranch team edits within the system.
- Build the side rail and mobile bar as an Elementor Theme Builder header with the
  off-canvas widget; the overlay markup here maps to it directly.
- Venue cards and history eras become ACF repeaters rendered through Elementor Loop Grid,
  so the ranch can add a venue without touching layout.
- Booking flows replace the `#availability` and `#inquire` form blocks with the booking
  engine's shortcode/iframe; the surrounding section markup stays.
- Serve video and images through the Cloudflare CDN.

---

© 2026 The Stampede Ranch · Design & development by Digital Marketing Collective
