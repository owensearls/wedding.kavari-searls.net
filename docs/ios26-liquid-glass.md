# iOS 26 Safari Liquid Glass — Full‑Bleed Native Look

Research + migration plan for making the wedding site render edge‑to‑edge behind
the notch / Dynamic Island and behind Safari 26's Liquid Glass chrome (URL bar +
toolbar), with the watercolor background showing *through* the glass instead of
solid bars.

> Research date: 2026‑06‑15. iOS 26 shipped Sept 2025; most sources are
> Feb‑2026‑era developer blogs. The tinting algorithm is **reverse‑engineered**,
> not documented by Apple, and has been shifting across point releases — so the
> final pixel‑level behavior **must be confirmed on a real device** running the
> current OS. See [Caveats](#caveats).

> ⚠️ **Read [§0 Prior on‑device findings](#0-prior-on-device-findings-authoritative) first.**
> Earlier hands‑on testing *on this exact site* overrides several optimistic
> web‑blog claims below. Most important: **you cannot show the watercolor image or
> a gradient *through* the glass bars** — Safari tints each bar a single solid
> color, sampled once at load. The "native full‑bleed" target is therefore
> *full‑bleed content + per‑edge solid tint matched to the artwork's edge tones*,
> not the artwork literally visible behind translucent glass.

---

## 0. Prior on‑device findings (authoritative)

This site has already been through extensive **on‑device iOS 26 testing**. Those
results outrank the web blogs in §2 wherever they conflict. Key facts:

- **The bar tint is a single solid color per edge, sampled once at page load, and
  is NOT re‑sampled on scroll.** Reloading at a non‑top scroll position changes
  what gets sampled. JS `background-color` changes after first paint do **not**
  update the bar.
- **You cannot show a gradient or image *through* the bars** via sampling. The
  bar will be one flat color. (So the web claims about "watercolor through the
  glass" / "real pixels behind the chrome via a scroll runway" in §2.9 do **not**
  hold for the sampled tint — see §2.9 for the corrected version.)
- The sampler reads the **static `background-color` of an element's layout box**
  near the edge. It **ignores visual‑only changes**: animated `background-color`,
  `transform: translateY()` to slide a strip out of the zone, and `opacity: 0` all
  **fail** — the layout box is still sampled. Only **`display: none`** / removal
  from layout excludes an element. **Do not retry transform/opacity tricks.**
- **`html` background and `theme-color` are ignored**; the fallback is **`body`**;
  a transparent fallback renders **grey/white**. Top and bottom bars are sampled
  **separately**.
- Sampled element must be **≥~80% wide, ≥3px tall, within ~3–4px of the edge**.
- **Glass compositing (a different mechanism) does work:** an element exposing
  **no `background-color`** (e.g. a `<canvas>`) is ignored by the sampler (falls
  back to body) **but the translucent bar still composites that element's live
  pixels**, which can be repainted every frame. This is the only known route to a
  *scroll‑dynamic* bar color. It was an active avenue (canvas‑behind‑chrome) but
  had not been confirmed shipping.
- **Prior conclusion (now being revisited):** an earlier session gave up on
  pushing the full UI under the chrome and scoped the work down to a minimal
  dynamic color under the mobile bottom bar only. **This request explicitly
  reopens the full‑bleed approach with a new architecture (single root div).**

**What this means for "fully native full‑bleed":**
1. Content extending full‑bleed behind the notch and chrome **is achievable**
   (`viewport-fit=cover` + `env(safe-area-inset-*)`).
2. The glass bars will be **solid colors**, not the artwork. The native look comes
   from coloring each edge's sampled strip to **match the watercolor's edge tone**
   (sky/blue at the top, lawn/green at the bottom) using **opaque** strips sized to
   `env(safe-area-inset-*)`.
3. A *dynamic* bottom‑bar color that tracks scroll is only possible via the
   **canvas compositing** trick, not sampling — treat as optional/experimental.

---

## 1. Executive summary

Achieving full‑bleed on iOS 26 is the *same two‑step foundation as iOS 11*:

1. `viewport-fit=cover` on the viewport meta tag — **required**, or content stops
   at the safe‑area boundary and Safari fills the gap with a solid bar.
2. `env(safe-area-inset-*)` to selectively pad **interactive** content away from
   the notch and toolbars.

What is **new in iOS 26** is how the Liquid Glass chrome is *tinted*:

- The `theme-color` meta tag is now **parsed but ignored**. It no longer controls
  anything in Safari 26. (Manifest/PWA `theme-color` is a separate story.)
- Safari instead **samples CSS `background-color`** to tint the top ("forehead")
  and bottom ("chin") glass bars, using a precedence chain:
  1. `background-color` of `position: fixed` / `position: sticky` elements that
     sit in a narrow band at the very top/bottom edge of the viewport,
  2. then the `<body>` `background-color`,
  3. then the `<html>` `background-color`,
  4. then a system default (**white** in light mode, black in dark).
- The glass is **composited on top of the page**, and Safari extends the page
  layout *underneath* it. Where the page actually paints pixels into that region,
  the translucent glass shows a blurred version of those pixels. Where it does
  **not** (or where a transparent fixed/sticky edge element is sampled), Safari
  falls back to the sampled/solid color — which is why transparent roots and
  transparent full‑width fixed elements produce **white bars**.

**This is exactly the current bug on this site.** Two transparent edge elements —
the sticky nav at `top: 0` and the fixed mountains footer at the bottom — sit in
the sampling band with no `background-color`, so Safari tints the bars with the
fallback instead of letting the fixed watercolor background show through.

**The single‑root‑div refactor you asked for is compatible with all of this**,
and is independently recommended by the sources — *but with one hard constraint*:
the wrapper div must **not** become a full‑viewport `position: fixed` element, and
the background color that should tint the chrome must stay reachable on
`html`/`body`. A wrapper div is most useful as the single thing you `filter:
blur()` when an overlay opens. See [§5](#5-the-single-root-div-question).

---

## 2. The mechanics in detail

### 2.1 `viewport-fit=cover` is mandatory (and unchanged)

Without `viewport-fit=cover`, iOS auto‑insets the page to the safe area and paints
a solid bar in the gap; `env(safe-area-inset-*)` also reports **0**. With it,
content extends behind the chrome/notch and the insets report real values. This is
WebKit's own documented two‑step technique from "Designing Websites for iPhone X"
and is unchanged through iOS 26.

- Confidence: **high** (3‑0). Sources: WebKit blog 7929; 1ar.io; polypane.app; MDN.
- ✅ This site already has `viewport-fit=cover`.

### 2.2 `env(safe-area-inset-*)` is Baseline, but gated on the above

`env()` / `safe-area-inset-*` is Baseline Widely Available (since Jan 2020, ~94%
support). The only catch is the activation gate above: insets read 0 until
`viewport-fit=cover` is present.

- Confidence: **high** (3‑0). Sources: MDN; caniuse; polypane.app.

### 2.3 `theme-color` is dead for Safari chrome tinting

Five independent developer sources unanimously confirm Safari 26 ignores the
`theme-color` value for chrome tinting. Don't rely on it.

- Confidence: **high** (3‑0 across 7 corroborating claims). Sources: 1ar.io;
  benfrain.com; nasedk.in; jahir.dev; mikepiontek.com.

### 2.4 The tint sampling algorithm

Tint precedence: **fixed/sticky edge element `background-color` → `body` bg →
`html` bg → system default (white/black)**. Corroborated by multiple blogs *and*
the primary WebKit bug #301756 (engineer Wenson Hsieh): the toolbar‑tint
extension applies where a viewport‑constrained fixed/sticky element borders an
obscured content inset, with the body background as fallback.

- Confidence: **high** (3‑0 for color sampling). The extra claim that
  `backdrop-filter` is also sampled is blog‑only (2‑1) and **not** confirmed by
  the WebKit source — treat as unverified.
- ⚠️ **On‑device correction (§0):** the web set produced a weak (1‑2) claim that
  `html` participates as a fallback tier. **On‑device testing on this site found
  `html` background is *ignored*; the fallback is `body`.** Put the tint‑relevant
  color on **`body`** (and a sampled edge strip), not `html`.

### 2.5 Edge‑element sampling thresholds (reverse‑engineered)

To be sampled for tinting, an edge element must be:

- within **4px of the top** (or **3px of the bottom**) of the viewport,
- at least **80% of viewport width** on iOS (90% on macOS),
- at least **3px tall**.

There's also an alternative partially‑off‑screen case (e.g. `bottom: -8px;
min-height: 12px`).

- Confidence: **high** (3‑0). Sources: jahir.dev; 1ar.io; andesco/safari‑color‑tinting.
- ⚠️ Reverse‑engineered; no Apple docs; may shift across Safari point releases.

### 2.6 Transparent fixed elements hijack the tint — even at `opacity: 0`

When a `position: fixed` element is on screen, Safari uses **its** background to
tint forehead/chin, overriding `body`. The algorithm reads even `opacity: 0` /
transparent backdrops, so a full‑page transparent overlay that "used to be fine"
now forces the bars to the fallback (white). Ben Frain filed this as a WebKit bug
(marked duplicate); a fix was **expected in iOS 26.2** — re‑test on the current OS.

- Confidence: **high** (3‑0). Sources: benfrain.com; 1ar.io; stripearmy/Medium.
- Practical rule: **hide overlays/backdrops with `display: none`, not
  `opacity: 0`**, and never leave a transparent full‑viewport fixed element mounted.

### 2.7 Transparent roots → white bars; set explicit backgrounds

With no explicit root/body color, the chrome falls back to white (light) / black
(dark). The documented remedy is an explicit `background-color` on `html` and
`body`. (For *real pixels* behind the glass, see §2.9.)

- Confidence: **high** (3‑0). Sources: mikepiontek.com; 1ar.io; nasedk.in.

### 2.8 Don't size full‑bleed regions with `100vh`

iOS Safari computes `100vh` against the **largest** viewport (UI hidden), so a
`100vh` block is too tall and part hides behind the chrome. Prefer `svh` / `lvh` /
`dvh` — **but test**: the claim that `100dvh` is *the* definitive fix was
**refuted (1‑2)**. Use the dynamic units and verify on device.

- Confidence: **high** (3‑0) for the `100vh` problem itself. Sources: bram.us; dev.to.
- ℹ️ This site already uses `100dvh` throughout.

### 2.9 Two‑image parallax / scroll background

- ⚠️ **On‑device correction (§0):** the "scroll runway → real page pixels behind
  the chrome" idea (1ar.io, medium confidence) **did not pan out on this site**.
  The bar tint is a flat color sampled once at load; the artwork does not show
  through the bars regardless of runway. **Do not build around the runway claim.**
  The only way to put live pixels under a bar is the **canvas compositing** trick
  (§0), which is separate from the parallax and optional.
- **Standards‑based parallax:** Safari 26 natively supports CSS scroll‑driven
  animations — `animation-timeline: view()` / `scroll()`, `animation-range`. This
  is the correct way to drive the parallax (no JS scroll listeners).
  - Confidence: **high** (3‑0). Source: WebKit blog 17333 (primary); CSS‑Tricks; MDN.
  - ℹ️ This site already uses `animation-timeline` + `view-timeline` for the
    mountains parallax — good, keep it.

---

## 3. How this maps onto the current code

Current architecture (relevant files):

- `components/ui/PageLayout.tsx` renders `<html>` → `<head>` → `<body>`; content
  is a **direct child of `<body>`**. Hydration is `hydrateRoot(document, …)`
  (`packages/rsc-utils/.../static-pages/client.ts`), i.e. the **whole document**
  is React‑controlled. There is **no `#root` element** today (the `#root` rule in
  `PageLayout.css` is vestigial).
- `components/ui/PageLayout.css`:
  - `html { background-color: #e4e7e2 }` ✅ (a fallback tint tier — light grey).
  - `body { background: transparent }` ⚠️ transparent body → body tier can't tint.
  - `body::before` paints the **fixed full‑bleed watercolor** with negative
    safe‑area insets (good: it paints into the chrome region) — but it's a
    *background‑image*, and the tint algorithm samples *background‑color*, not
    images. So body::before does **not** set the bar tint.
- `components/BackgroundLayout.tsx` / `.module.css`:
  - `.nav` is `position: sticky; top: 0; z-index: 4` with a **transparent**
    background → sits in the top 4px sampling band → **hijacks the top bar to the
    fallback color**. ⚠️ Prime suspect for the top‑bar issue.
  - `.footerFixed` is `position: fixed; bottom: -safe-area; left/right: 0` holding
    the mountains `<img>` (no `background-color`) → sits in the bottom sampling
    band → **hijacks the bottom bar**. ⚠️ Prime suspect for the bottom‑bar issue.

**Diagnosis:** even though the watercolor is painted full‑bleed behind the chrome,
the two transparent edge elements win the sampling precedence and force the glass
bars to the fallback color — you don't see the watercolor through the glass.

---

## 4. Definitive recipe (what "correct" looks like)

Reconciled with the on‑device findings in §0. The realistic native target is
**full‑bleed content + a solid, on‑brand tint per edge**, not artwork‑through‑glass.

1. Keep `viewport-fit=cover`. ✅
2. Set an explicit, on‑brand `background-color` on **`body`** (not transparent, not
   relying on `html`) as the fallback so a bar is never white/grey. Keep `body`
   transparent **only** where a negative‑z background layer must show through the
   *visible* page — but then provide the bar tint via dedicated **opaque edge
   strips** (next point).
3. **Tint each bar deliberately with an opaque strip** sized to
   `env(safe-area-inset-top)` / `env(safe-area-inset-bottom)`, ≥80% wide, ≥3px
   tall, within ~3–4px of the edge, colored to match the watercolor's edge tone
   (sky at top, lawn at bottom). This is what Safari samples → a clean per‑edge
   native tint. Top and bottom are sampled independently, so use two strips.
4. **Keep transparent fixed/sticky elements OUT of the edge sampling bands** so
   they don't steal the sample from your tint strips. Specifically the sticky nav
   (top band) and the fixed mountains (bottom band) must not be the sampled element
   unless you intend them to be the tint.
5. The visible full‑bleed artwork still paints into the safe‑area region (fixed
   layer with negative insets) so the *content area* is full‑bleed — but accept
   that the *bars* show the strip color, not the artwork.
6. Pad only **interactive** content with `env(safe-area-inset-*)` (nav target,
   RSVP form, footer credits) so nothing tappable hides under the notch/toolbar.
7. Hide any future overlay/modal with `display: none` (never `opacity: 0`); never
   mount a transparent full‑viewport fixed element; never use transform/opacity to
   try to swap a sampled strip (§0 — proven not to work).
8. Keep the CSS scroll‑driven parallax for the *content* (it works). A
   *scroll‑dynamic bar color* is only possible via the **canvas compositing**
   experiment (§0) — optional, separate, unconfirmed.

---

## 5. The single‑root‑div question

**Verdict: do it — it's compatible and recommended — with constraints.**

Sources explicitly recommend wrapping the app in one root div, primarily so you
have a single element to `filter: blur()` when an overlay opens, while `html` /
`body` keep control of the chrome tint. No source found that a single root div
harms full‑bleed. (This specific architecture wasn't tested head‑on by any source,
so the recommendation is **synthesized** from the verified tint mechanism +
blur fix → confidence **medium**.)

**Hard constraints for the wrapper:**

- The wrapper is the **normal scrolling container** — `position: relative`/static,
  **not** `position: fixed` full‑viewport (a full‑viewport fixed wrapper would
  itself be sampled and hijack the tint).
- Keep an explicit `background-color` on `html` and `body` as the tint fallback;
  don't move *that responsibility* onto the wrapper if the wrapper isn't in the
  sampling band.
- The fixed full‑bleed background layer can live inside the wrapper (as a fixed
  child with negative safe‑area insets) — that's fine and keeps everything "inside
  the div" as you want, since fixed positioning is viewport‑relative regardless of
  DOM parent.

**Benefit for this codebase:** today the safe‑area + background logic is scattered
across `body`, `body::before`, and `.footerFixed`. Consolidating into one wrapper
(`<div id="app">` with a fixed background child) gives you a single place to reason
about full‑bleed and insets, and on desktop you can restyle that one container
freely without touching behavior.

---

## 6. Proposed migration plan

> Behavior is **identical** on all platforms; only layout/structure changes.
> Desktop visual layout may change; desktop behavior must not.

### Phase 0 — Establish device test loop (do first)

- Confirm the actual symptom on a real iOS 26 device (current point release).
- Capture before screenshots: top bar, bottom bar, notch, at `scrollY = 0` and
  mid‑scroll. The algorithm is reverse‑engineered, so we tune against the device.

### Phase 1 — Introduce the single root wrapper (no visual change yet)

1. In `PageLayout.tsx`, wrap `{children}` in `<div id="app" className={…}>` inside
   `<body>`. Keep the initial‑scroll `<script>` where it is.
2. Add an `App.module.css` (or extend `PageLayout.css`) with
   `#app { position: relative; width: 100%; min-height: 100dvh; }`.
3. Verify hydration still targets `document` and nothing breaks (RSC unaffected —
   we're adding a DOM level, not changing the hydration root).

### Phase 2 — Consolidate background + insets onto the wrapper

1. Move the fixed watercolor from `body::before` to a fixed child of `#app`
   (e.g. `<div class="bgLayer">` or `#app::before`, negative z) with the same
   negative safe‑area insets so the *content area* stays full‑bleed. Keep `body`
   transparent only as needed so this negative‑z layer shows through the visible
   page (an opaque body buries it — a known past mistake).
2. Remove the vestigial `#root` rule.
3. (Bar tint is handled by dedicated strips in Phase 3, not by `body`/`html` bg,
   since `html` is ignored and `body` must stay transparent for the artwork.)

### Phase 3 — Tint the bars correctly (the actual bug)

The current bug: the transparent sticky `.nav` (top band) and fixed `.footerFixed`
mountains (bottom band) are what Safari samples, so the bars get a transparent →
grey/white fallback. Fix by sampling **intentional opaque strips** instead.

1. **Top strip:** add an opaque element across the top, height
   `env(safe-area-inset-top)`, ≥80% wide, colored to the sky tone, within the top
   ~3–4px band — and keep the sticky `.nav` *out* of that band (e.g. position the
   nav below the inset) so the strip wins the sample.
2. **Bottom strip:** add an opaque element across the bottom, height
   `env(safe-area-inset-bottom)`, colored to the lawn tone, in the bottom band —
   and ensure the fixed mountains element is **not** the sampled box (move it out
   of the 3px band or layer the strip beneath it). Per §0, do **not** use
   transform/opacity to swap strips — only `display`/layout changes work.
3. Verify on device that top shows sky tone and bottom shows lawn tone (sampled
   independently), with no grey/white.

### Phase 4 — Safe‑area padding pass

- Audit interactive content (nav link, RSVP lookup/form, footer credits) and apply
  `env(safe-area-inset-*)` so nothing tappable hides under notch/toolbar; remove
  redundant/scattered inset rules now centralized in the wrapper.

### Phase 5 — Desktop layout

- With everything in `#app`, apply desktop‑only layout (max‑width, centering,
  whatever's desired) to the wrapper via media queries. Behavior unchanged.

### Phase 6 — Device verification + tuning

- Re‑test on iOS 26: confirm watercolor shows through both glass bars, no white
  bars, no flash at `scrollY = 0` (add scroll runway if needed), notch clearance
  correct, parallax intact.
- Test light mode (site is `color-scheme: light`). Sanity‑check Android Chrome and
  desktop Safari/Chrome for regressions.

### Out of scope / guard against

- Don't reintroduce `theme-color` for tinting (ignored).
- Don't use `opacity: 0` to hide future overlays (`display: none`).
- Don't make `#app` a full‑viewport `position: fixed` element.

---

## 7. Caveats & open questions

**Source quality.** Mostly developer blogs (1ar.io, benfrain.com, nasedk.in,
jahir.dev, mikepiontek.com, stripearmy). Only two primary WebKit sources: the
scroll‑driven‑animations feature blog (high quality) and WebKit bug #301756
(corroborates fixed/sticky‑near‑edge sampling). The exact thresholds
(4px/3px/80%/90%/3px) are community reverse‑engineering with **no** official Apple
docs and may change between point releases.

**Time sensitivity.** Fast‑moving. The modal‑hijacks‑tint behavior had a fix
**expected in iOS 26.2**, so some described behavior may already differ on the
current OS — re‑test.

**Refuted claims worth heeding.**
- `100dvh` alone is **not** confirmed as the definitive viewport‑height fix (1‑2) —
  test `svh`/`lvh`/`dvh`.
- "`html` background is ignored, body‑only" was **refuted** (1‑2) — set a
  background on **both** `html` and `body`.
- "fixed/sticky content below the floating bottom bar is clipped" was **refuted**
  (1‑2).

**Open questions to resolve on device.**
1. Has the modal/popover tint‑hijack fix (expected iOS 26.2) actually shipped, and
   what's the corrected behavior now?
2. Is `backdrop-filter` genuinely sampled for tint, or only `background-color`?
3. Precise interaction between `html` and `body` background in the fallback chain.
4. Exact scroll‑runway amount that reliably prevents a `scrollY = 0` fallback flash
   without fighting the `animation-range` tuning.

---

## 8. Sources

Primary:
- WebKit — Designing Websites for iPhone X: https://webkit.org/blog/7929/
- WebKit — Features in Safari 26.0 (scroll‑driven animations):
  https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- WebKit bug #301756 (toolbar tint sampling): https://bugs.webkit.org/show_bug.cgi?id=301756

Practitioner blogs:
- https://1ar.io/updates/safari-26-liquid-glass-web/
- https://benfrain.com/ios26-safari-theme-color-tab-tinting-with-fixed-position-elements/
- https://nasedk.in/blog/ios26-safari-toolbar-colors/
- https://jahir.dev/blog/safari-toolbar
- https://mikepiontek.com/journal/safari-26-and-liquid-glass.html
- https://stripearmy.medium.com/ios-26-0-be-prepared-for-viewport-changes-in-safari-e867d7eace43
- https://polypane.app/blog/using-safe-area-inset-to-build-mobile-safe-layouts/
- https://www.bram.us/2020/05/06/100vh-in-safari-on-ios/

Reference:
- https://github.com/andesco/safari-color-tinting
- MDN: `env()` / `safe-area-inset-*`, meta viewport, CSS scroll‑driven animations
- caniuse: `mdn-css_types_env_safe-area-inset-bottom`
