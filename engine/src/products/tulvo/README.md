# Tulvo product screens

Tulvo's web app (light mode), rebuilt in Remotion so every number, row and card can move on cue in a video.

## Read this first

- **The capture is from 20 Oct 2026.** Every screen here was copied from the signed-in app on that day, at 1512x805 CSS pixels (screenshots at twice that). Tulvo has changed since. Re-capture the screens you need and compare them before you rely on any of them in a film.
- **Real product screens only.** The studio shows the real product and never invents a screen, a button, a label or a state the app does not have (starting rule 23, and "never invent its screens" in the demo playbook). A rebuilt screen is allowed only because it matches a real capture. If a film needs something the app cannot show, say so; do not build it.
- **Names come from fixtures only.** See the data rule below.

## Where things are

Everything lives in `engine/src/products/tulvo/`. Product screens belong to a brand, so they sit in their own folder under `src/products/` instead of in the brand-neutral kit. This is the one place in `src` that may name a brand, a colour or a typeface: a product screen must look exactly like the product, so it takes nothing from the brand in use.

| Path | What |
|---|---|
| `TulvoApp.tsx` | `<TulvoApp>`, the app window (1512x805), which loads the app's CSS and font. `<AppStage>` places that window in any scene. |
| `app.scoped.css` | The live app's own compiled CSS (Tailwind v3 and shadcn), limited to the inside of `<TulvoApp>`. Made by `tools/scope-css.mjs`; never edit it by hand. |
| `fonts.ts` | Loads Inter from the engine's local file. Nothing goes online. |
| `shell/` | The sidebar, the top bar and `AppShell`, the frame every page sits in. |
| `screens/` | The screens: shell, boards, home dashboard and charts, onboarding, deploy, people, integrations, data templates. `screens/index.ts` lists them. |
| `fixtures.ts` | The sample data every screen shows by default (cleared names only), and the product's own words (deal statuses, roles, onboarding steps). |
| `icons/` | The app's own icons, copied path for path, and a neutral tile for other companies' logos. `icons.md` says which icon each captured one is. |
| `Gallery.tsx` | Turns every screen into a composition called `TulvoUi-<id>`. |
| `tools/` | Capture and check tools: `scope-css.mjs`, `gen-app-icons.py`, `identify-icons.mjs`, `render-stills.sh`, `compare.sh`. |

The engine registers the gallery through `src/products/index.tsx`, which `src/Root.tsx` mounts with one line (`<ProductCompositions />`). In Remotion Studio the screens are in the "products" folder, under "TulvoUi".

## Use a screen in a scene

Put the screen inside `<AppStage>`. It draws the app at its real size (1512x805) and then moves and scales the whole window, so text, spacing and layout stay exactly as captured. Drive its props from the frame.

```tsx
import { AppStage } from '../../products/tulvo/TulvoApp';
import { BoardPage } from '../../products/tulvo/screens/boards';

<AppStage scale={0.95} x={-180} y={420}>
  <BoardPage {...props} />
</AppStage>
```

- `scale`, `x` and `y` place the window. `transform` adds anything else, such as a slight tilt.
- Never make the app smaller by changing its width or font size. Scale the stage instead.
- Every screen is a plain component: anything that moves (a highlighted card, typed text, a scroll position, a chart drawing in) is a prop. The app's own CSS animations are switched off, so the scene decides all timing.
- The app's colours and Inter belong to the product. Film type around the window (headlines, labels, captions) still comes from the brand in use.

## Font

Inter is loaded from `engine/public/brands/tulvo/fonts/inter-latin-opsz-normal.woff2`. It is the variable Inter the live app uses, with both the weight axis (100 to 900) and the optical size axis (14 to 32), so headings get the same tighter spacing as in the app. It is registered as "Tulvo Inter" so it never clashes with another Inter. A render waits until it has loaded, and stops if it cannot load it.

The file is there because `brands/tulvo/brand.json` names it as Tulvo's product typeface and `tools/brand/sync.mjs` copies it. If that entry is removed, these screens stop rendering, on purpose. Only Latin characters are loaded; anything outside Latin falls back to another font.

## Data rule

Every visible word and number comes from props. The defaults come from `fixtures.ts`, which uses **only** the cleared names from the 20 Oct research (Callie Pembrook Studio, Ollaine Skin, Corwen Audio, Morrowby Coffee, Kitbury Luggage, Brackwood Furniture, Dani Halloran, Omar Haddad, Theo Grant, the workshop "Run It Like a Studio" and so on).

The captures hold AI sample data with names that may belong to real companies, and the account's e-mail address. **Never copy record text, names or e-mail addresses from a capture into code, fixtures or notes.** `captureMatch` keeps the captured counts but swaps in cleared names.

Product words are copied exactly: deal statuses Prospecting, Pitch Sent, Negotiation, Contract Review, Signed, Live and Closed; roles Contributor, Editor and Admin (never "Administrator"); the seven onboarding steps. Other companies' names appear only as plain text, never as logos; their logo slots show a neutral tile unless a cleared logo is passed in.

## Add or change a screen

1. Find the captured page and its screenshot. Copy the markup of the area you need with its class names exactly as captured.
2. Make `screens/<Name>Screen.tsx` that exports the component and a `TulvoUiScreen` entry (`id`, `component`, `defaultProps`). `ShellScreen.tsx` is the smallest example.
3. Add one import line and one entry to `screens/index.ts`. Nothing else needs to change.
4. Render it and compare it with the screenshot until the two are hard to tell apart (below).

Rules for a screen:
- Pure and driven by props: no timers, no state, no CSS transitions. The parent scene drives movement from the frame.
- Render app content only. The gallery and `<AppStage>` add the window.
- `defaultProps` must be plain data (Remotion saves it as JSON).
- Hover never happens in a render. To show a hover, pass a prop and apply the hover look (see `hoverKey` in `shell/Sidebar.tsx`). Scroll positions are props too.
- Use only class names that exist in `app.scoped.css`. The engine has no Tailwind, so any other class does nothing. For a one-off value, use an inline `style`.
- Leave out `max-*`, `2xl:` and `3xl:` variants and `!`-important classes with viewport units; set the value they resolve to at 1512 px inline instead (for example `width: calc(75 * var(--tulvo-vw))`).

## How the app's CSS is kept to the app window

`tools/scope-css.mjs` merges the captured CSS files and rewrites every rule so it applies only inside `<TulvoApp>`. The page's root, body and `#root` rules land on the window's own elements, each selector gains the same small extra weight so the app's own order of rules is unchanged, and screen-size rules are fixed for the 1512x805 window. Viewport units become `--tulvo-vw` and `--tulvo-vh`, which `<TulvoApp>` sets from its size, so a screen looks the same in any composition size. Dark-mode rules are dropped, animations are renamed and switched off. Outside the window none of it matches anything.

Run it again after a new capture: `node src/products/tulvo/tools/scope-css.mjs` from `engine/` (`--help` lists the options; the default input is the 20 Oct capture folder).

## Render and compare

From `engine/`:

```bash
src/products/tulvo/tools/render-stills.sh                 # every TulvoUi screen, into out/tulvo-ui/stills/
src/products/tulvo/tools/render-stills.sh Shell           # one screen ("TulvoUi-Shell" also works)
SCALE=2 src/products/tulvo/tools/render-stills.sh Shell   # twice the size, like the captures
src/products/tulvo/tools/compare.sh <still.png> <screenshot.jpg> <out.png>   # side by side, difference, blend
```

`render-stills.sh` holds the engine's render lock (`out/.render.lock`) while it runs and refuses to start if another render holds it. Rendering needs Chrome, which cannot start inside Claude's command sandbox.

Compare at twice the size and let `compare.sh` scale down: that matches how the screenshots were made. Text and positions should line up, with only faint outlines in the difference image. Small coloured text shows up in the difference because of JPEG blur; that is not a real difference.

## Checks so far

- 11 Nov 2026: moved here from the older `remotion-studio` project. All 54 `TulvoUi` screens (58 stills, counting extra frames of the two moving demos) were rendered here and in the old project with the same Chrome and compared pixel by pixel. 47 are identical to the pixel. 11 differ slightly (PSNR 49 to 57 dB, under 0.04% of pixels), and all for one reason: the old project's Tailwind v4 registers its gradient colour variables in a way that makes the app's own gradients invisible. Two of the app's gradients therefore show again here, as they do in the live app: the white fade at the bottom of the onboarding form (4 onboarding screens), and the faint white sheen over the site preview in the deploy editor (7 deploy screens). Checked by building the old project without Tailwind, which matched this engine exactly, and with this kit's local font, which matched the old renders exactly, so the font file changes nothing.
- 20 to 21 Oct 2026 (old project): `TulvoUi-Shell` against the captures, sidebar mean difference 2.0 to 3.2 out of 255, sidebar border and colours matching pixel for pixel.

## Known gaps

- Empty sidebar sections ("No recent pages yet") were measured from a screenshot, not copied from the page; the empty label for Private was never seen.
- The Tulvo AI side panel is not part of the app frame yet.
- The cookie settings button (bottom left on the live site) is off by default.
- Rich-text documents (DM Sans) and code (JetBrains Mono) fonts are not loaded; add them as local files if a screen ever shows them.
- The capture tools still point at the 20 Oct research folder (`Desktop/Tulvo/outputs/tulvo-ugc-meta-ad-2026-10-20/research/`). Point them at the new capture when it is made.
