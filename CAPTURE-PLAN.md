# Capture tool: enhancement plan

Written 11 Nov 2026 (night) at the owner's request. Approved the same night with the answers in section 12. Phases 2 to 6 are done (3 not yet tried by a person in their own Chrome; 6's phone apps only against stand-ins, this Mac has no simulator); phases 7 and 8 follow.

The capture tool turns a real product into footage the studio can animate. This plan takes it from "a scripted recording of one web app" to a tool that can film any product a company might make (a web app, a WordPress plugin, an AI product, a browser extension, a phone app, a command-line tool) through the browsers people already use, and that hands the engine everything it needs for fluid, high-quality motion.

Three principles hold throughout:

1. **Real product only.** Every frame comes from the real product on a known date. Motion may make the product move better than it does; it never shows a screen, field, number or state the product does not have.
2. **Record clean, animate later.** The tool records the plain product with no cursor, no zoom and no effects, plus a precise log of what happened where and when. Every cursor, zoom, highlight, transition and speed change is added in the engine, so it can be changed without recording again.
3. **Any company.** Nothing assumes Tulvo. What a product needs (where it lives, how to make demo data, what to hide, what never to show) lives in that brand's folder.

---

## 1. Where we are: version 1 (being built now)

| Part | What it does |
|---|---|
| Sign in | `capture.mjs signin <brand>` opens the studio's own Chrome window with a saved profile for that brand. A person signs in once, by hand |
| Capture script | Plain steps in the job: open, click, type, press, hover, scroll, wait, mark |
| Recording | 1920 × 1080 window at double sharpness, recorded frame by frame from Chrome, assembled into 3840 × 2160 at 60 frames a second. No cursor in the picture |
| Motion log | `cursor.json`: where the mouse went and when it clicked, pressed and typed |
| Stills | A full-sharpness still at every mark |
| Freshness check | Runs the steps again and says which marks look different |
| Engine | A `CaptureClip` that plays a recording with the brand's cursor drawn on top, with an optional zoom |
| Hand lane | Cap, installed by the person, for recordings made by hand |

Version 1 is the floor this plan builds on. Its test on Tulvo is still to come.

---

## 2. What we will film: products and what is special about each

| Kind of product | Examples | What makes it hard | What the tool needs |
|---|---|---|---|
| **AI web products** | Tulvo, chat assistants, generators | A different answer every take; answers stream in word by word; waits of 5–60 s; "Beta" labels; content the AI made up may be wrong | Record a real answer once and replay it for retakes; "wait until the text stops changing"; speed up waits with a label; a person reads every generated word before it is used |
| **Work apps (boards, tables, CRMs, dashboards)** | Tulvo boards, project tools | Drag and drop; virtual lists that only exist when scrolled to; live numbers; "2 minutes ago" timestamps; real-time updates | Smooth drag paths; scroll-to-find; frozen clock; element tracking |
| **WordPress plugins** | Dokan, form builders, ERP, membership and email plugins | Admin screens full of other plugins' notices; update nags; setup wizards; the block editor's welcome guide; several roles (admin, vendor, customer); a front end and a back end; emails the plugin sends; WooCommerce checkout | Throwaway demo sites built from a recipe (WordPress Playground or Local); notice clean-up; sign-in per role; email capture; test-mode payments |
| **Online shops and shop apps** | WooCommerce stores, Shopify apps | Checkout; payment forms inside third-party frames; product photos that must be ours; stock and prices | Test-mode payments only; frames inside pages; demo catalogue recipes |
| **Marketing sites and landing pages** | tulvo.io, plugin landing pages | Long pages; animations that fire on scroll; videos and carousels; cookie banners | Full-page stills that the engine scrolls smoothly; scroll-trigger capture; banner removal |
| **Browser extensions** | A Chrome extension's popup or side panel | The toolbar popup cannot be opened by a script; side panels; overlays on other people's websites | Load the extension in the studio's Chrome; open its popup as a page and frame it as a popup; film overlays only on sites we own or demo pages |
| **Desktop apps** | Electron apps (Slack-like), native Mac apps | Not a web page | Electron apps can be scripted with the same tool; native apps go through the hand lane (Cap) |
| **Phone apps and mobile web** | iOS and Android apps, mobile versions of web apps | Touch, not mouse; status bar; keyboard | Mobile web: phone-size window with touch. Native: the iOS Simulator and Android emulator recorders, with a scripted tap list |
| **Command-line and developer tools** | CLIs, setup commands, APIs | A terminal, not a page; typing speed; long output | VHS (free, open source): a scripted terminal recording, crisp at any size |
| **Emails and notifications the product sends** | Order confirmations, invites, reports | Lands in an inbox, not in the product | A local test inbox (Mailpit for WordPress) or a demo inbox; the email shown in a neutral mail frame drawn by the engine; never a real inbox |
| **Integrations with other products** | Slack, Stripe, Google Sheets | Other companies' screens and logos | Film only our side; other products as plain names or neutral tiles; any logo needs a person's yes (studio rule 18) |
| **Multi-person moments** | An invite arriving, a teammate's comment, a customer and a vendor | Two people at once | Two windows signed in as two demo users, recorded together on one clock, laid out side by side |

---

## 3. Which browser does the work

People asked for the tool to "work through our browsers". There are five browsers in play, and each suits a different job.

| Browser | Good for | Not good for | Notes |
|---|---|---|---|
| **A. Your own Chrome, through the Playwright extension** (new) | Recording with the sign-ins you already have: no second sign-in, no second password, your demo workspace already open | Unattended checks at night (needs your Chrome open) | Microsoft's free "Playwright Extension" from the Chrome Web Store lets a tool drive a tab you choose. Details below |
| **B. The studio's own Chrome window** (version 1) | Repeatable takes; freshness checks; a profile kept clean for filming; teams sharing a demo account | Needs one sign-in per brand | Saved in `.capture/<brand>/`, on this Mac only, never synced |
| **C. Claude's browser pane in the desktop app** | Walking a flow while planning; writing the capture script; quick stills for the storyboard | Final recordings (it cannot give the tool high-quality frames) | Already signed in to Tulvo |
| **D. Claude in Chrome** | Same as C, in your own Chrome | Final recordings | Optional |
| **E. By hand with Cap** | A person demonstrating, a native app, a tutorial in someone's own voice | Smooth, repeatable product shots | Cap's own zoom and cursor effects off; the engine adds them |

**How A works, and its catches:**
- You install the Playwright Extension once and pick one tab on its page each time. The tool then opens a tab of its own next to it and works only there (and in pop-ups that tab opens); it never attaches to the tab you picked, and never touches your other tabs, bookmarks, passwords or cookies. (Built 12 Nov: `tools/capture/yourchrome.mjs`.)
- Since Chrome 136 (2025), a tool can no longer attach to your everyday Chrome profile directly; the extension is the supported way.
- While the tool drives the tab, Chrome shows a "being controlled" bar above the page. It sits outside the page, so it is not in the recording, but it changes the window size. So the tool fixes the page size itself (1920 × 1080 at double sharpness) whatever size your window is.
- Your own extensions can draw on the page: password manager icons inside fields, grammar checkers, translation bars, ad blockers that hide parts of the product. The tool looks for anything drawn by an extension before it records and either hides it or stops and names it. Chrome's own autofill suggestions are switched off for the take.
- Your browser zoom (for example 110%) is reset to 100% for the take and put back after.
- If your Chrome is in dark mode and the product follows it, the tool sets light or dark as the shot list says.

**Recommended default:** A for recording, B for freshness checks and for any takes that must match exactly across days. C for planning.

---

## 4. Preparing the product for filming (set dressing)

A product must look its best and the same in every take. Each brand gets a **filming recipe** in `brands/<brand>/product/capture.json`.

### 4.1 Demo data, made and reset by recipe

| Product | How demo data is made | How it is reset |
|---|---|---|
| Tulvo and other products with a connector | The connector builds boards, records and pages | A fresh board or page per video, deleted by hand after (the connector cannot delete) |
| WordPress plugins | A WordPress Playground recipe (a "blueprint": a JSON list of steps that installs WordPress, the plugin, a theme, demo content and users) or a Local site with WP-CLI commands | Playground starts fresh every time; Local sites restore a saved copy |
| Shops | A demo catalogue file (products, photos we own, prices) imported by recipe | Re-import |
| Anything else | A list of steps through the product itself, captured once as its own script ("setup" script) | A matching "tidy up" script |

Every recipe uses the brand's cleared names only (made-up businesses checked against real ones). A recipe that would show a real customer, e-mail or order is refused.

### 4.2 A clean screen, automatically

Before every take the tool applies the brand's clean-screen list, then checks it worked:

- **Hidden:** cookie banners, chat widgets (Intercom, Crisp, Tawk), feedback tabs, developer toolbars, "update available" nags, other plugins' admin notices (WordPress), browser scrollbars (the engine draws a calm one if a scroll needs it), the text caret's blink (kept steady), spellcheck squiggles, Chrome autofill.
- **Dismissed once:** onboarding tours, "what's new" pop-ups, the WordPress block editor's welcome guide, setup wizards the video is not about. Each brand lists the ones it knows; anything unexpected that covers the page stops the take with a still of it.
- **Kept, because they are true:** "Beta" labels, real limits, real empty states the video is about.
- **Set:** language, region, time zone, light or dark theme, reduced motion off, pointer type (mouse or touch), and the page size.

### 4.3 A frozen clock

The tool sets the product's clock to the video's demo date and time (for example 20 Nov 2026, 10:30), and lets it run from there. "2 minutes ago", calendars, due dates, charts by day and greetings ("Good morning") then match the voice and stay the same across takes. Products that take the time from their server (most dashboards) are noted in the recipe; for those, demo data is made with dates relative to the demo date.

### 4.4 Waiting for the page to be ready

A take never starts on a half-loaded page. "Ready" means: fonts loaded, images decoded, no network requests for half a second, and the picture has stopped changing for a quarter of a second (the product's own animations have finished). The same "has the picture settled" test is used after every step.

### 4.5 Privacy, enforced

- **Never-show list** per brand (billing pages, real e-mails, admin areas, a broken chart): checked on every page the take visits. A match stops the take.
- **Automatic scan:** every e-mail address, phone number and person's name on screen is compared with the brand's cleared names. Anything not on the list is blurred in the stills and flagged for a person before the footage is used.
- **Fields the tool will not touch:** passwords, card numbers (outside a payment provider's test mode), sign-in codes. It also never solves or skips a "prove you are human" test: it stops and asks.

---

## 5. The capture script, in full

A capture script is a list of plain steps in `jobs/<job>/capture/<id>.json`. Claude writes it from the storyboard while walking the flow in the browser pane; the owner approves it with the storyboard.

### 5.1 Steps

| Step | What it does | Details that matter |
|---|---|---|
| `open` | Goes to a page in the product | Stays inside the brand's own addresses unless a full address is given |
| `click`, `double-click`, `right-click` | Clicks a thing found by its visible words or label | Optional "in" or "near" to pick the right one when two match. Right-click menus drawn by the product only (the system's own menu is not filmable) |
| `type` | Types text into a field at a human rhythm | Bursts of 3 to 6 characters, 40–70 ms each, a short pause at spaces (craft file 05). Every character's time is logged |
| `paste` | Puts a long text in at once | For prompts and long notes; the engine can still show it as typed at speed with a "Sped up" label |
| `press` | A key or a shortcut | Shortcuts are logged so the engine can show them as key caps in tutorials |
| `select` | Picks an option from a list | Product-drawn lists only. Lists drawn by the system (plain HTML `select` menus) do not appear in the recording; the tool warns and suggests showing the result instead |
| `check`, `toggle` | Ticks a box or flips a switch | |
| `drag` | Drags from one thing to another on an eased path with small in-between moves | Needed for boards, sorting, sliders, file drops. Logged as a path |
| `hover` | Rests on a thing so its hover look and tooltips show | |
| `scroll` | Scrolls smoothly to a thing, or by an amount | Scrolled frame by frame along an eased curve, never with jumpy mouse-wheel steps. For long pages the tool can instead take one tall still and let the engine scroll it, which is perfectly smooth |
| `upload` | Puts a file from the job into a file field | The system's file window never appears; the shot shows the file arriving |
| `wait for` | Waits until words appear, a thing appears or goes, the page settles, or AI text stops changing | Has a time limit; says in plain words what it was waiting for if it gives up |
| `switch` | Moves to a new tab, a pop-up window, or a frame inside the page | Pop-up windows the product opens are followed and recorded too |
| `back`, `reload` | | |
| `size` | Changes the page size mid-take, for example desktop to phone | For "works on any device" moments |
| `theme` | Light or dark | |
| `mark` | Names a moment | Saves a full-sharpness still, the page's words, and where every tracked thing is |
| `track` | Starts following named things on screen | Their position and size are logged every frame (see section 6) |
| `layer` | Saves one thing on its own, with a see-through background | For lifting a card off the screen, flying a button into the next scene, or building a scene from parts |
| `snapshot` | Saves the page's code for one area | Only when single rows or numbers must move on cue in the engine |
| `mask` | Blurs a thing for the whole take | |
| `line` | Ties the next step to a voice line | So the engine can land a click on the word that names it |
| `as` | Switches to a second demo user's window | For two-person moments |

### 5.2 Ways to make a script

- **Written by Claude** from the storyboard, after walking the flow in the browser pane.
- **Recorded by showing (new):** a person clicks through the flow once in the tool's window; the tool writes the steps down (Playwright's open-source recorder does this), cleans them (removes stray clicks, hesitations and wrong turns) and replays them smoothly. This lets a product manager who knows the product make the script without writing it.
- **Edited in plain words:** "slower on the second click", "skip the confirmation" are applied to the script and replayed.

### 5.3 Takes

- **Rehearse:** runs the steps visibly at half speed without recording, so a person can watch the path.
- **Dry run:** runs fast without recording, to check every step finds its target.
- **Take:** records. Takes are numbered and kept; the best is chosen by a person or by the checks.
- **Resume from step N:** after a failure, starts again from the last mark before the failing step, with the page put back in the state it had there (by replaying the steps before it quickly, unrecorded).
- **Failure screen:** when a step fails, the tool saves a still and the page's words at that moment, and says in plain words what it looked for and what it found instead.

### 5.4 AI answers

- **Record once, replay for retakes:** the first good take saves the product's real network answers; retakes replay them, so the AI's answer and its timing are the same in every take. The footage is labelled with the date the real answer was made. If the product changes how it answers, the replay is refused and a fresh answer is recorded.
- **Waits:** "wait until the text stops changing" with a time limit. Real waits over 0.6 s are marked so the engine speeds them up with a "Sped up" label (craft file 05).
- **Read before use:** every generated word is shown to a person before the footage goes into a scene. Anything wrong, odd or unflattering means a new answer, not an edit.

---

## 6. What the tool hands the engine (the key to fluid motion)

Everything below is saved with every take, on the recording's own clock, so motion can be designed after recording.

| File | What it holds | What it makes possible |
|---|---|---|
| `recording.mp4` | The clean product, 3840 × 2160, 60 fps | |
| `cursor.json` | The mouse path, clicks, presses, every typed character with its time, the shape the cursor would have (arrow, hand, text bar) at each moment | A cursor drawn by the engine that matches what the product would show; typing sounds on each key |
| `tracks.json` (new) | Position and size of every tracked thing, every frame; the page's scroll position; when pages, dialogs and menus open and close | Zooms that land exactly on a button; highlights that stay glued to a moving card; captions placed where they cover no UI; checks that text is big enough after a zoom |
| `marks/` | Full-sharpness stills and the page's words at each mark | Storyboard frames; freshness checks; on-screen wording checks |
| `layers/` (new) | Single things saved with see-through backgrounds, at full sharpness | Lifting a card, a button flying into the next scene, shared-element transitions |
| `tall/` (new) | Full-page stills of long pages | Perfectly smooth scrolls and page tours |
| `snapshots/` (new) | A page area's code, when asked for | Rows and numbers that move on cue |
| `capture.json` | Date, time, address, brand, browser used, page size, every step with its time, the recipe and clock used, warnings | Proof of where every frame came from (the delivery check) |

**Recording quality details:**
- Chrome sends a new frame only when the picture changes. The tool keeps every frame's real time and holds frames to build a steady 60 fps, and reports any stretch where frames were late (a busy computer).
- For pages with heavy animation, a **frame-by-frame mode** pauses the page's clock and steps it one sixtieth of a second at a time, taking a still each step. It is slower to record but perfectly smooth on any computer. It is the same method the engine uses to render films.
- Colours are tagged so the footage does not look washed out or too dark after encoding.
- Sound from the product (notification pings) is not recorded; the engine adds the brand's own sounds from the event log, so they are always clean and at the right level.

---

## 7. The engine: fluid, high-quality motion from the capture

These are built in the engine, brand-neutral, and added to the motion library with a preview each.

### 7.1 Cursor

- Drawn by the engine from the event log, in the brand's style, at about 1.5 times real size so it reads on a phone (craft file 05).
- **Re-pathed:** the engine keeps the click points and timings but draws its own path between them: an arc, easing out of rest and into the target, 350–600 ms a move, arriving 100–150 ms before the click. So the cursor is always graceful even if the recorded mouse path was not.
- **Click:** presses to 90%, a ring spreads from the point, the target reacts, all within 120 ms.
- **Shape:** arrow, hand over links and buttons, text bar over fields, taken from the log.
- **Hides while typing,** and fades after its last job, so it never wanders.
- **Motion blur** on fast moves only.
- **Touch version** for phone shots: a soft dot with a press ring, no arrow.

### 7.2 Camera

- **Auto-zoom on action:** before a click or typing, the camera eases in on the tracked thing with room around it, holds, and eases out when the action is done. Like the screen recorders people know (Screen Studio, Cap) but driven by the real position of the real thing, not a guess from the mouse.
- Follows the cursor 100–200 ms behind, and moves less than the cursor (craft file 05).
- **Never zooms while something must be read,** and never further than keeps text at least 4% of frame height and sharp (the recording's double sharpness allows up to two times zoom with no loss).
- Spring easing with no wobble; one camera direction per shot (studio rule 4).
- Hand-set camera keys override the automatic ones for any shot.
- **Tilt and depth:** up to 10° on wide shots only, never on a screen that must be read.

### 7.3 Time

- **Speed ramps:** long real waits and long typing play faster with a "Sped up" label, easing in and out of the faster speed.
- **Pin to the voice:** each click or result can be pinned to a word of the voice line; the engine stretches or squeezes the moments between actions (never the actions themselves) so the picture lands on the word. The voice is never touched (studio rule 16).
- **Trim and skip:** cut out a dead stretch with a short, clean jump.
- **Freeze:** hold a frame for a proof moment while the background stays alive.

### 7.4 Emphasis, glued to the real thing

All of these use the tracked position, so they stay glued even while the page moves.

- Spotlight: everything else dims and softens by 30–50%.
- Drawn ring or underline in the accent colour.
- Lift: the thing's own layer rises off the screen, 2–3% larger with a deeper shadow.
- Magnifier: a round loupe over a small detail.
- Callout label with a short line to the thing (sparingly; one per beat).
- Step numbers for tutorials.
- Text highlight on the key words after they are typed.
- Privacy blur that follows the thing.

One emphasis per beat; two cancel out (craft file 05).

### 7.5 Transitions between captures and scenes

| Transition | What it looks like | Uses |
|---|---|---|
| Zoom through | The camera dives into the clicked button and comes out on the next page | `tracks.json` of both takes |
| Shared element | A card in a list flies and grows into its own detail page | Layers from both takes |
| Match cut on the click | The cut lands on the exact frame of the click | `cursor.json` |
| Push and slide | The next page pushes the last one out in the direction the cursor was moving | Cursor direction |
| Container grow | A small thing grows into the next full screen | Layer and track |
| Scroll relay | One page scrolls out as the next scrolls in, at the same speed | Scroll log |
| Whip | A fast pan with motion blur, for energy (hype only) | |
| Window split | One window becomes two (before and after, two users, desktop and phone) | Two takes on one clock |
| Device swap | The same moment moves from a laptop to a phone frame | Takes at two page sizes |
| Cross-fade | Fallback only | |

The library already has zoom-through-swap, shared-element, container-transform, push-through, relay-scroll and momentum-cut moves; this plan connects them to real captures instead of drawn mock-ups.

### 7.6 Frames and layouts

- **A clean browser frame drawn by the engine** (light or dark, brand-neutral, with the address from `capture.json` or none), or no frame: the screen as a card on the stage (craft file 05, "Staging a screen").
- **Device frames** that look like a laptop or phone without being any company's device.
- **Two or three screens at once:** side by side, overlapping, or phone over laptop.
- **Email frame:** a neutral mail window for emails the product sends.
- **Terminal frame** for command-line recordings.

### 7.7 Other sizes

- **9:16 and 1:1 from the same take:** the camera follows the tracked action inside the wide recording, keeping the thing that matters in the frame.
- **Or a second take at phone size** when the product has a real mobile layout; the shot list says which.

### 7.8 Sound from the event log

Clicks, key presses, a whoosh on a transition, a soft "ding" when a result lands, all placed from the log at the brand's levels, inside the mix rules (effects between a third and two thirds of the voice).

---

### 7.9 The catalogue: presets, cursors, camera, staging, animations and transitions (added 11 Nov, night, owner)

Everything here is brand-neutral: it takes the brand's colours, type, corner radius and sound kit, and the film's energy (calm, confident, hype). Each item goes into `library/motion/` with a preview clip on a real capture, its props, and which video types and energies it suits. A scene picks items by name; a **look preset** picks a matching set in one word.

Two limits apply to every item: one emphasis per beat (craft file 05), and nothing from the "Not to copy" list in `knowledge/craft/00-principles.md` (no hand-drawn cursor, no brush smears, no 12-drawings-a-second passages).

#### Look presets (one word sets cursor, camera, staging, emphasis, transitions and pace together)

| Preset | Feels like | Cursor | Camera | Staging | Transitions | Pace |
|---|---|---|---|---|---|---|
| **Calm explainer** | Unhurried, premium | Classic, slow arcs | Slow eased zooms, long holds, no tilt | Flat card on the stage | Cross-dissolve, container grow | Calm |
| **Product demo** (default) | Clear and confident | Classic or brand | Auto-zoom on each action, gentle follow | Card or clean browser frame | Zoom through, match cut, push | Confident |
| **Launch** | Big, cinematic | Brand, with soft motion blur | 3D float, dolly-ins, crane-up reveals | Floating 3D screen, exploded layers | Shared element, depth push, whip | Hype |
| **Tutorial** | Patient, precise | Large classic, click rings, key caps | Zoom to every click, steady holds | Clean browser frame | Cuts and soft slides only | Calm |
| **Social vertical** | Fast, bold, sound-off | Large brand, bold click | Tight crop-follow, snap zooms | Phone-shaped crop of the action | Snap cut, whip | Hype |
| **Feature montage** | Many things, quickly | Minimal dot | Small push on each | Grid or wall of screens | Grid zoom, stack shuffle | Hype |
| **Documentary** | Honest, raw | Real path, classic | Almost still; cuts | Full screen, no frame | Straight cuts | Confident |
| **Two people** | Collaboration | Named cursors, one per person | Split, follow whoever acts | Two windows side by side | Window split | Confident |

#### Cursor styles

| Style | What it looks like | Good for |
|---|---|---|
| Classic arrow | A clean, generic arrow with a soft shadow (not any company's own artwork) | Most demos |
| Brand arrow | The arrow in the brand's accent or ink, with its corner radius | Branded launches |
| Minimal dot | A small solid dot | Montages, calm films |
| Halo | A soft ring of light around the point | Dark stages |
| Spotlight | The pointer lights a soft circle; the rest of the screen dims slightly | Guiding the eye in busy screens |
| Presenter | Larger arrow with a bold outline, readable on a phone | Social, tutorials |
| Named cursor | An arrow with a name tag in a colour ("Dani"), as in shared editors | Two-person moments |
| Touch | A soft dot that presses, with a ring; drags leave a short fading line | Phone shots |
| Text bar and hand | The arrow turns into a text bar over fields and a hand over links, as the product would | Automatic, all styles |
| Hidden | No cursor; the camera and highlights lead | Cinematic shots |

**Click effects** (one per film): ring that spreads, soft pulse filling the button, short burst of lines (hype only), press squish of the pointer, or no visual and sound only.
**Hover effects:** gentle magnet that pulls the pointer onto a button's centre in the last few frames; a soft glow on the hovered thing.
**Trails:** none (default), soft motion blur on fast moves, a short fading line (hype and touch only).
**Typing:** the caret glows while typing; shortcuts appear as key caps near the bottom ("Cmd K"), each cap pressing as its key goes down.
**Idle:** the pointer fades after 1.2 s of rest and returns before its next move.

#### Camera moves

| Move | What it does |
|---|---|
| Auto-zoom | Eases in on the tracked thing before an action, holds, eases out after |
| Push in, pull out | A slow move in or a reveal out from a detail to the whole screen |
| Follow | Pans with the cursor, 100–200 ms behind, moving less than it |
| Snap zoom | A fast zoom with a tiny settle, for beats (hype only) |
| Dolly and tilt | The screen turns up to 10° in depth while the camera moves in; wides only |
| Float | The screen drifts very slowly in 3D, alive through holds |
| Crane reveal | Starts tight on one thing, rises to show the whole page or several screens |
| Orbit | A small turn around a floating screen, for launch hero shots |
| Rack focus | Focus moves from one thing to another; the rest softens |
| Pan across | A smooth slide across a long page or a wall of screens |
| Spring settle | Any move can end with a soft spring, or none (calm uses none) |

Hand-set camera keys override any of these on a shot.

#### Staging (where the screen sits)

Flat card on the stage; clean browser frame (light or dark); frameless full screen; floating 3D screen with depth shadow; isometric view; laptop, desktop monitor, tablet and phone frames that look like no company's device; stacked windows; split screen (two or three); picture in picture; grid of screens; scrolling wall of screens; **exploded view** (the screen's layers separate in depth, from captured layers); **before and after slider** (a line wipes between two takes of the same screen); email frame; terminal frame; a notification arriving at the top of a phone.

#### Animations on the product (glued to real things by tracking)

| Animation | What it does | Truth rule |
|---|---|---|
| Lift | The thing rises off the screen, slightly larger, deeper shadow | Real layer |
| Isolate | The thing stays; everything else fades to the stage | Real layer |
| Fly out | The thing comes forward to the middle while the screen blurs behind | Real layer |
| Focus pull | The rest dims and softens 30–50% | |
| Outline trace | A line draws itself around the thing in the accent colour | |
| Underline and ring | Drawn marks under or around words | |
| Highlight sweep | A soft band of light passes over the thing once | |
| Magnifier | A round loupe enlarges a small detail | |
| Callout | A short label with a line to the thing | One per beat |
| Arrow | A clean, drawn arrow from one thing to another | Not hand-drawn |
| Connection line | A line runs from one thing to another to show data moving (a form to a table) | Both things real |
| Step badges | Numbered marks for tutorials | |
| Re-staggered list | Rows of a real list arrive one by one | Rows from the real capture or code snapshot |
| Number roll | A real number rolls up to its value | Only the real value |
| Chart draw | A real chart draws itself | From the code snapshot |
| Typed again | A field's real text retypes with a glowing caret, at any speed | Real text |
| Toast pop | The product's own message gets a gentle extra pop and a sound | Real message |
| Success moment | A short check or confetti in the brand's colours when a result lands | Sparingly; hype or launch only |
| Blur reveal | A thing sharpens into view | |
| Privacy blur | Follows a thing that must not be read | |

#### Transitions

| Transition | What it looks like |
|---|---|
| Zoom through | The camera dives into the clicked button and comes out on the next page |
| Shared element | A card flies and grows into its own detail page |
| Match cut on the click | The cut lands on the click's exact frame |
| Container grow | A small thing grows into the next full screen |
| Push and slide | The next screen pushes the last one out, in the cursor's direction |
| Depth push | The screen recedes into depth while the next comes forward |
| Circle reveal | The next screen opens as a circle from the click point |
| Card flip | The screen turns over in 3D to show the next one |
| Stack shuffle | Screens slide past each other like cards |
| Grid zoom | Zoom out to a grid of screens, then into another one |
| Scroll relay | One page scrolls out as the next scrolls in |
| Cursor drag | The cursor drags the next screen into place |
| Whip | A fast pan with motion blur (hype only) |
| Window split | One window becomes two |
| Device swap | The same moment moves from laptop to phone |
| Blur dissolve | A soft blur through to the next shot |
| Cross-dissolve | Fallback |

Left out on purpose: page curls, glitches, light leaks and spinning cube turns. They look cheap or off-brand for software.

#### Time

Speed ramps (smooth or snappy), sped-up label, freeze with a slow push, rewind (a short reverse for "undo" stories), clean jump over dead time, loopable endings for social, and pinning any event to a word of the voice.

#### Capture-side presets (in the capture tool)

| Preset | Choices |
|---|---|
| Product kind | Web app, AI product, WordPress plugin, shop, browser extension, desktop (Electron), phone web, phone app, command line (each fills sensible clean-screen, wait and privacy defaults) |
| Page size | Desktop 1920 × 1080, laptop 1440 × 900, tablet 1024 × 1366, phone 390 × 844 and 430 × 932, each at double sharpness; light or dark |
| Mouse pace | Calm, confident, brisk (how fast the real mouse and typing move during the take; motion is re-timed in the engine anyway) |
| Typing pace | Human (bursts, 40–70 ms a character), quick, or paste |

#### Sounds tied to events

Soft click, crisp click, soft keyboard, crisp keyboard, small whoosh, large whoosh, success chime, toast pop, drag lift and drop. Made once per brand with the studio's sound tool (a paid ElevenLabs call, asked for first), stored in the brand's sound kit, and placed automatically from the event log within the mix rules.

## 8. Checks that come with it

| Check | What it catches |
|---|---|
| **Freshness** | Before delivery, the steps run again. Each mark is compared three ways: the picture, the words on the page, and where things sit. The report says, for example, "the 'New lead' button moved and is now called 'Add lead'". Anything changed means a new take of that part. Built: `capture.mjs check` (and `compare` for two saved takes) |
| **Never-show and privacy** | On every take and every frame used |
| **Readable after zoom** | Text in the final frame is at least 4% of frame height (this finishes item 12's text-size check). Built: `tools/checks/text_size.mjs`; the floor for product screens is a setting (`--ui-floor`), 4% by default and also reported against 3% until the owner chooses |
| **Captions clear of UI** | Captions never sit over a tracked thing (finishes the captions-over-UI check in item 12). Built: `tools/checks/captions_clear.mjs` |
| **Smooth** | The existing smoothness check, on the finished film |
| **Proof of source** | Every product shot in the delivered film is listed with its take, date and address. A shot with no source fails delivery. Built: `tools/film/sources.mjs`, a step of the delivery stage |

---

## 9. Edge cases, and what the tool does about each

### Sign-in and accounts
- **Signed out mid-take:** stops, keeps the take so far, asks for a fresh sign-in, resumes from the last mark.
- **Two-step sign-in codes, magic links by e-mail:** a person does them in the sign-in window. Never automated.
- **"Prove you are human" tests:** stop and ask. Never solved or skipped.
- **Several roles (admin, vendor, customer):** one saved sign-in per role per brand; steps say which role (`as`).

### Things that differ between takes
- **AI answers:** record once, replay (5.4).
- **Feature flags and A/B tests:** the product may show a different screen to the same account on different days. The freshness check catches it; the recipe notes any flag that must be on.
- **Random order, live numbers, "today":** frozen clock, demo data with fixed values, and a warning when a number on screen changes between takes.
- **Toasts and pop-ups that vanish on a timer:** a mark or a hold can be placed while they are up; the frozen clock keeps their timing the same.

### Pages that fight the camera
- **Lazy-loaded images and endless lists:** scroll slowly first, unrecorded, so everything is loaded; then record.
- **Lists that only exist when scrolled to:** `click` scrolls to find the thing before giving up.
- **Things inside frames from other sites (payments, embeds):** steps can reach into frames; payment frames use the provider's test mode only.
- **Parts drawn on a canvas (some charts, editors, maps):** there are no named things to find, so steps use positions relative to a named area, and the picture is tracked by region.
- **Hidden inside components (shadow DOM):** found the same way as anything else.
- **Hover menus that close when the mouse leaves:** the cursor path stays inside them.
- **Drag and drop that needs many small moves:** the drag path is broken into small steps.

### Things the browser draws outside the page
These never appear in the recording: the system's file picker, print window, plain HTML drop-down lists, the system's right-click menu, browser alerts and confirmations, permission prompts, the password manager. The tool warns when a step would rely on one, handles the alert or prompt itself, and the shot shows the result rather than inventing the window.

### Your own Chrome (browser A)
- Extension drawings on the page, autofill, translation bar, zoom level, dark mode: see section 3.
- You keep working in other tabs while it records: fine; the tool records its own tab only. Closing that tab stops the take cleanly.

### The computer
- **Slow or busy Mac:** late frames are reported; the frame-by-frame mode is offered.
- **Different screens and Macs:** the page size and sharpness are set by the tool, so every Mac records the same frame.
- **Network drop:** the step waits up to its limit, then stops with the reason.
- **Disk:** a 60-second take at full sharpness is roughly 1–3 GB before compression; recordings live in the job's `out` and `capture` folders that are never synced, and old takes can be cleared.

### WordPress specifics
- Other plugins' notices and nags hidden; the plugin's own notices kept only if the video is about them.
- The sample "Hello world!" post, the default theme's look and the admin colour scheme set by recipe.
- Setup wizards completed by recipe unless the video is about setup.
- Pretty web addresses switched on by recipe.
- Emails caught by a local test inbox, never sent.
- Multisite, translations and right-to-left languages by recipe when a video needs them.

### Wording and languages
- Longer words in other languages can break layouts; the freshness check flags text that runs out of its box.
- Right-to-left languages flip the cursor's natural path; the engine re-paths accordingly.

---

## 10. Safety, rights and sharing

- Only products the brand owns, or demo sites it has made. The tool refuses addresses outside the brand's list unless a person adds them.
- Demo accounts and test-mode payments only. No real customer, order, e-mail or message is ever filmed.
- No password, card number or sign-in code is typed, read or saved by the tool. Sign-ins stay on the Mac they were made on, in `.capture/`, never synced or shared.
- Other companies' screens and logos follow studio rule 18.
- **Open-source parts, all free:** Playwright and its Chrome extension (Microsoft, Apache 2.0); VHS for terminals (MIT); WordPress Playground (GPL, runs on its own, not bundled); Mailpit (MIT); ffmpeg. Cap (AGPL) is installed by the person, not bundled. For sharing with other companies (DESIGN.md section 14, items 23–27) none of these needs a fee; each company installs its own copies through the installer.
- Everything company-specific lives in `brands/<brand>/product/`: the address, demo account names, recipes, clean-screen list, never-show list, roles, and the kind of product. A product-kind preset (web app, WordPress, shop, extension, desktop, phone, command line) fills sensible defaults at stage 0.

---

## 11. Build order

Each phase ends with a test on three products: Tulvo (AI work app), one WordPress plugin demo site, and the practice page. Each phase is done when its tests pass and DESIGN.md says what was and was not checked.

| Phase | What | Done when |
|---|---|---|
| **1** (now) | Version 1 | Practice page and one Tulvo flow captured; freshness check reports no change on a re-run |
| **2. Reliable takes** (done 11 Nov) | Clean-screen rules; frozen clock; "page has settled" waits; AI "text stopped changing" waits; privacy scan and blur; never-show enforcement; rehearse, dry run, numbered takes, resume from a mark; plain-words failure screens; all step types in 5.1 except `layer`, `snapshot`, `as` | The same Tulvo flow recorded three times gives the same marks; a planted cookie banner and a planted real-looking e-mail are both caught<br>**Done 11 Nov (night), on the practice page.** Three takes of a 51-step script gave identical marks (9 of 9 at 0.0000% difference, words identical); a `--from` take matched them too; the planted cookie banner, chat widget and "what's new" pop-up were hidden or dismissed; the planted real-looking e-mail, phone number and name were blurred and flagged; the planted never-show text stopped the take. Also built: `tracks.json` in a simple per-frame form (phase 4 can extend it). **Not checked:** Tulvo (not signed in yet), so the "same Tulvo flow three times" test is still to do; a WordPress site; real third-party cookie and chat scripts (only look-alikes); Chrome autofill with saved data; drag and drop by the browser's own drag events (only pointer-event boards); scrolls still show about one late frame in 75 on this Mac (frame-by-frame mode in a later phase fixes it). |
| **3. Your own Chrome** (done 12 Nov) | Browser A through the Playwright extension, with the page-size lock, extension-drawing detection, autofill off and zoom reset; recording by showing (5.2) | A take through your Chrome matches a take through the studio's window frame for frame at the marks<br>**Done 12 Nov 2026, tested in a throwaway Chrome profile with Microsoft's extension built from its own source; not yet tried by a person in their own Chrome.** `--browser mine` (the default for `run`, `rehearse`, `dry` and `show`; `check` keeps the studio's window) reaches your Chrome through a small relay on this Mac (`tools/capture/yourchrome.mjs`, extension protocol 2, as Playwright MCP's `--extension` mode). You pick a tab on the extension's page; the tool never attaches to it, opens a tab of its own beside it, drives only that tab and its pop-ups, and closes it after. Tested: a 1280 x 860 window gave full 3840 x 2160 pictures (Chrome 157 sends window-sized pictures each time its picture feed starts until the page size is set again, so the tool sets it again and drops those pictures); 110% zoom was made up for exactly in layout and sharpness; a test extension's badge, picture, element outside the page body and icons inside fields were all hidden and named; a translated page stopped the take with its name; autofill attributes off; no answer from the person stopped after `--wait` with plain steps; `show` wrote a clean 10-step script from a 19-action session (dropped a stray click, a menu opened and closed, a page opened and left, a hover before a click, typing corrections) and never read the password typed; `rehearse` replayed it. **Not met exactly:** marks from your Chrome and from the studio's window have the same layout and content but differ in about 0.6% of pixels (text edges, drawn on screen versus hidden; 110% versus 100% zoom differs as much), so they are not frame for frame identical, and `check` refuses to compare takes from different browsers. **Cannot be done through the extension:** the page's language and time zone (Chrome allows those to trusted tools only; the take warns and suggests `--browser studio`), changing your zoom (made up for instead), and keeping your own mouse from disturbing the take. |
| **4. Motion data and the engine** | `tracks.json`, layers, tall stills; engine cursor re-pathing; the look presets, cursor styles, click, hover, typing and idle effects, camera moves, staging and product animations of section 7.9; speed ramps and time effects; pin to voice; capture-side presets; sound from the log (sound files made only after the owner says yes to the paid call) | A 20-second scene built from one Tulvo take with auto-zoom, a lift and a sped-up wait passes the smoothness and readability checks<br>**Part A done 12 Nov (night), on a practice page (engine motion).** `CaptureClip` now re-paths the pointer between the recorded clicks (arcs, 350 to 600 ms, in place 125 ms before every click and still through it, hidden while typing, fading after 1.2 s of rest), draws nine pointer styles, five click effects, magnet and glow on hover, a glowing field while typing and key caps for shortcuts; zooms in on each action from `tracks.json` and follows the pointer, plus push in, pull out, snap zoom, dolly and tilt, float, crane reveal, orbit, rack focus and pan across, with hand-set moves overriding; and runs speed ramps with a "Sped up" label, freezes with a slow push, clean jumps, rewinds, pins and a loopable end through one time map. Eight look presets set it all in one word. 42 library entries with previews; `tools/checks/capture_motion.mjs` measures it. Tested on a 30 s practice take: 5 of 5 clicks reached 125 ms before the button and still to 0.00 px; moves 369 to 550 ms; no pointer or camera jumps in any look; every zoomed frame kept at least 6% room around its tracked thing (or the page's own edge); a 3x ramp over a drag kept the dragged card and the pointer as close as at real speed, best matched at zero frames' shift; a pinned click landed 0 frames off, and its picture 54 frames later than unpinned (53.5 expected).<br>**Part B done 12 Nov (night), on Tulvo's boards take and a practice take (staging, animations on the product, sound placement).** `CaptureShot` places a capture in twenty stagings: flat card, clean browser frame light and dark (address from `capture.json`), full screen, floating screen, isometric, generic laptop, monitor, tablet and phone, a tall crop that follows the action, stacked windows, two or three takes side by side, picture in picture, grid, wall of screens, before and after, mail and terminal; takes shown together run on one clock and `align: "marks"` pins the extra take's marks to the first take's frames. Eighteen animations on the product (lift, isolate, fly out, focus pull, outline, underline, ring, sweep, magnifier, callout, arrow, connection line, step badges, typed again, toast pop, success moment for hype and launch only, blur reveal, privacy blur) all take their place from one function (`anchorOf`) through the picture's own camera, and those that move or enlarge a thing are cut from the recording's pixels. The looks now stage themselves (launch floats, tutorial uses the browser frame and numbers each step, social vertical crops tall, feature montage is a grid, documentary is full screen, two people is a split). `planSounds` and `tools/audio/capture_sounds.mjs` place ten named sound slots from the event log through the time map into the job's `sfx.json` for `mix.py`. 39 library entries; `library/motion/product-sheet.jpg`. Measured: on a render with a camera move and two scrolls (`tools/checks/capture_glue.mjs`), an outline stayed within 1.4 px and a lifted layer within 1.5 px of the real card in every frame (328 and 308 frames, 183 of them while the page scrolled); this needed two fixes found by measuring: Chrome's pictures of a scroll arrive up to 18 px late and unevenly, so `tools/film/seen_scroll.mjs` now measures where the picture really scrolled (`seen.json`, read by the engine), and the decoder could take the frame before the one asked for, so the engine now asks a quarter frame in. Frame lock: one take shown twice side by side differed by at most 1.4 grey levels (of 255) in every moving frame, against 4.6 on average and 11.1 at most with one side a frame late; before and after of one take, the movement either side of the line lined up best at zero frames (correlation 0.95, against 0.59 and 0.57 a frame either way); a light and a dark take aligned by marks landed their four marks 0, 0, 1 and 0 frames apart (28 to 30 frames apart unaligned; one mark could not be pinned and still landed a frame off). `smoothness.py` on all 46 previews: no jumps the engine added (it flagged three, in the full-screen and documentary previews, all Tulvo's own cards replacing their loading placeholders in one frame, as in the raw recording; a judder it found in the wall of screens was fixed by moving its columns with sub-pixel transforms); `capture_motion.mjs`: clicks 125 ms after arrival, no pointer or camera jumps. The sound plan went through `mix.py` (loudest effect 36% of the voice).<br>**Found:** takes recorded out of sight in the studio's window (`--browser studio` without `--show`) on this Mac came out about 0.9 s shorter than their cursor and tracks clocks, with typing and scrolls played faster in the picture, so nothing glued to them matched; with `--show` they matched to a frame. Tulvo's take (no typing or scroll) matched. The capture tool was not changed.<br>**Not checked:** the other sixteen animations on a render frame by frame (they share the measured anchor), dark product screens, a phone-size take, the exploded view and the phone notification (need layers from the capture side), any preview watched frame by frame (contact sheet only), sound by ear (Tulvo has no sound kit yet), the 20 s Tulvo scene, a readability check after zoom, transitions (phase 5) |
| **5. Transitions** | The transitions of 7.5 and 7.9 wired to real captures; the frames and multi-screen staging not done in phase 4 | A three-take sequence joined with zoom-through and shared element, checked frame by frame<br>**Built 12 Nov 2026, tested on Tulvo's boards take 2 (two parts joined at the click on "Campaign Launch Board") and on take 1 into take 2.** `CaptureJoin` (`engine/src/kit/capture/transitions.tsx`, plan in `joins.ts`) joins two captures or two parts of one (`splitAtClick`) on one film clock with any of twenty transitions: cut, match cut on the click, snap cut, zoom through, shared element, container grow, push, soft slide, depth push, circle reveal, card flip, stack shuffle, grid zoom, scroll relay, cursor drag, whip, window split, device swap, blur dissolve and cross-dissolve. Each hangs on the click in `cursor.json`, takes the clicked thing from `tracks.json` (or a page rectangle measured from a mark), pushes the way the pointer last moved, starts a scroll relay at the take's own scroll speed, carries one pointer across, and starts the next shot on the last shot's camera view where the join goes through the click. Lengths follow the energy (the `scene` token held to 600 to 900 ms: 900, 750, 638 ms; cuts one frame; whip and snap cut hype only). The eight looks name their transitions (7.9 table). 20 library entries with half-size previews; contact sheet `library/motion/transition-sheet.jpg`; `tools/checks/capture_transitions.mjs` measures the plan. Measured at 1920 x 1080: pointer jump at the hand-over 0.00 px (match cut), 0.13 px (zoom through), 0.01 px (shared element), at most 0.13 px for every join that carries the pointer; the clicked thing 0.00, 0.00 and 0.08 px (zoom through measured on every frame of its dissolve); the same on take 1 into take 2; calm and hype the same within 0.7 px. A straight cut moves the pointer 126 px by design. `smoothness.py` on all 21 previews (20 joins and a take 1 into take 2 match cut): no jumps or judder anywhere, inside or outside the joins, after one fix (the grid zoom's edge screens popped out in one frame at its end; they now fade); `capture_motion.mjs` on both parts: click 125 ms after arrival, no pointer or camera jumps. **Found:** the boards take was re-recorded twice by the capture tool while this was built (takes 3 and 4), so the tests use fixed copies of takes 1 and 2 (`engine/public/jobs/tulvo-capture-test/capture/boards-take-1` and `-take-2`); Tulvo's picture still shows loading placeholders for about 0.4 s after "settled" (cards at 7.2 s against 6.83 s), so the previews start the second part at 7.25 s; the capture tool's list (`engine/public/captures.json`) drops captures whose folder it looks for one level too high, so the boards take was missing from it (the files were there; not changed, it is in `tools/capture/`). **Not checked:** the three-take sequence, any join watched frame by frame (contact sheet only), dark products, phone-size takes, stagings other than card, frameless, browser and laptop for the pointer (the others fade it across), a real scroll relay at speed (the take has no scroll), sound on the joins. |
| **6. Product kinds** | WordPress recipes (Playground, Local, WP-CLI, test inbox, roles); AI answer replay; shops in test mode; extensions; Electron; mobile web and the phone simulators; terminals with VHS; two-user takes | One short capture of each kind, each through its recipe<br>**Part A done 12 Nov 2026, on local practice pages, a tiny local server whose AI answer changes on every call, a test extension and a test inbox folder; a temporary test brand and job, removed after. Tulvo: one look-only dry run.** Built: product-kind presets (`tools/capture/kinds.mjs`; `"kind"` in the brand's or the script's file; `capture.mjs kinds`); AI answers recorded once and replayed (`answers.mjs`; `capture.mjs answers`, `--fresh-answers`); the `layer` and `snapshot` steps (`parts.mjs`); the `as` step with `signin <brand> --as <role>`; extensions loaded from a folder with `{"open": "extension:popup"}` and `"extension:side panel"`; phone web with touch; `capture.mjs email` (a `.eml` or `.html` file, a folder, or Mailpit on this Mac); `setup` and `tidy` scripts per brand (`"recipes"`), Tulvo's as look-only placeholders. Measured: **AI answers:** the first take recorded 1 call (14 pieces over 2.1 s) into `answers.har` and `answers.json`; no token, cookie, session or key value from the practice server is in either file (0 matches), and its token address was never recorded; the retake replayed the same 14 pieces and words, arriving 0 to 10 ms from the original times, and the server's call count stayed at 2; asking a different question was refused in plain words, the old answers kept aside, and a fresh one recorded in the same run (count 3); `check` on the replayed capture: no change (0.000%). **Layer:** a 914 x 303 card came out as a 1980 x 782 PNG, transparent corners, 100% opaque inside the card and identical to the page's still there (mean difference 0.00), outside it 30% clear and 70% its own shadow, 0% solid; the 10 pictures Chrome drew without the page's background (0.34 s) were left out, and every frame of the recording matched its first (largest difference 0.00 of 255). **Snapshot:** 13 parts (3 rows, 6 numbers, 4 lines of words) and 10 CSS rules; rendered on its own it was 914 x 302.6 like the page and differed by 0.76 of 255 on average (1.1% of pixels more than 24 off, at text edges); it found and fixed a line height passed in pixels (21 px too short). **Two users:** each window with its own saved sign-in (the practice chat showed Ana and Ben); a message sent at 4.10 s changed both recordings on the same frame (4.117 s), the reply at 8.54 s both at 8.600 s; two recordings of 10.58 s, `cursor-customer.json` and one `events.json`. **Extension:** Chrome 157 refuses `--load-extension` (`ERR_BLOCKED_BY_CLIENT`), so it is loaded through DevTools (`Extensions.loadUnpacked`); the popup measured 320 x 170, grew to 320 x 186 after its button was clicked and the page followed, giving a 640 x 372 recording hanging from the top; the side panel 360 x 900; `capture.json` says `extension popup`. **Phone web:** 390 x 844 recorded at 780 x 1688; the page saw `hover: none` and two touches; `cursor.json` has `"input": "touch"`, 2 taps and 2 swipes with the finger's path (52 rows for a 600 px scroll); a `hover` step stops with a plain message. **E-mail:** a multipart `.eml` (quoted-printable HTML, a picture by Content-ID, an encoded subject) was shown at 700 x 900 with its own picture and the tracking picture blocked; an e-mail address, a phone number and a never-show match blurred (3 areas), the header's private address left out of `email.json`; a 6 s recording scrolled 756 px; with no Mailpit running it said how to start it. **Setup and tidy:** each take started with exactly one setup message in the chat and ended with none, also after a take that stopped (chat count 0). Found and fixed along the way: a popup whose size changed came out with its last picture missing, because ffmpeg reads every picture of a recording with the first one's decoder (the framed pictures were PNG among JPEGs); the tidy script's click was being logged into the take. **Not checked:** the engine showing two users side by side or using layers and snapshots (the files are in place for it; nothing in `engine/` changed); recording an answer in your own Chrome (the first take of an answer, phone takes, two-user takes and extension takes run in the studio's window); answers fetched without `fetch()` stream whole after the same wait (only checked by reading the code); Mailpit itself; a real WordPress site, shop, Tulvo AI answer or published extension; cross-site style sheets in a snapshot (reported, not read); an email scroll is in whole device pixels (6 or 7 a frame).<br>**For part B (WordPress recipes, Electron, phone simulators, terminals):** `kinds.mjs` already holds the `wordpress` preset (notices, welcome guide, `/wp-login.php`, heartbeat) and the `desktop`, `phone app` and `command line` kinds, which stop with "comes with part B" until their recorders exist (`recorder` in the preset); the setup and tidy scripts (`runRecipe` in `capture.mjs`) run in the main window before the first page and after recording, so a WordPress recipe that builds a Playground site needs its own step before the browser opens; the email command already reads Mailpit, so WordPress only needs its mail sent to port 1025; a recording's size now follows the take's page (cursor.json `page`), which phone simulator recordings should keep; second demo users use `.capture/<brand>/as/<role>/`, which WordPress roles (admin, vendor, customer) can reuse.<br>**Part B done 12 Nov 2026, so phase 6 is done; tested on practice material only (a temporary test brand and job per kind, removed after; Tulvo not recorded).** Built: **WordPress demo sites** (`tools/capture/site.mjs`; `capture.mjs site <brand>`): a brand's `product/blueprint.json` (a WordPress Playground blueprint, plus `users` per role and plugins from a local zip) is built by `@wp-playground/cli` 3.1.61 through npx before Chrome opens, served on `127.0.0.1`, and torn down after every run, check, rehearsal and show; a small must-use plugin written into the throwaway site only turns off update nags, the admin e-mail check and the welcome guides, drops "Howdy", and signs demo users in from a link with the site's own random key (no password typed, nothing to sign in by hand; `as` steps reuse it per role); "bring your own environment" is the brand's `address` with `"site": "own"`, signed in by hand. **Desktop apps** (`"kind": "desktop"`, `"app": { "path" }`): an Electron app, packaged or from its source folder, opened through Playwright's Electron support and driven by the same steps, page size and sharpness set through DevTools as for your own Chrome. **Command-line tools** (`tools/capture/terminal.mjs`): the commands run for real in a pseudo-terminal (macOS `script`) in a fresh folder, then xterm.js 6.0.0 (a project-local package) draws the session in Chrome, one picture per change, at double sharpness; `cursor.json` logs every key, each command and its exit code, and quiet stretches as waits the engine may speed up; `terminal.cast` keeps the session; VHS is not needed. **Phone apps** (`tools/capture/phone.mjs`): iOS through `xcrun simctl` (boot, install, open, status bar 9:41, light or dark, `recordVideo`) with idb for taps, typing, swipes and labels; Android through adb (`input`, `uiautomator`, demo mode, `screenrecord`). All four write the take's usual files and `capture.json` `"source"`; the part A stops are gone; `check` and `dry` work for all. Measured: **WordPress:** first build 95.9 s (fetching Playground, about 1 GB, once), later builds 16 to 55 s; a take of the Duplicate Post plugin's settings page (one free wordpress.org plugin) came out 3840 x 2160, 60 fps, 5.2 s, 3 marks, 2 clicks, no notices, "admin" without "Howdy"; the block editor opened with no welcome guide; an `as` step showed the editor-role user's own admin ("Ana Ruiz"); a wrong key got 403; a plugin from a local zip showed its settings page; after each run the site no longer answered. **Desktop:** a small Electron 45.1.0 notes app, from its folder and as a packaged `.app`: 2200 x 1376 (its 1100 x 688 window at double sharpness), 37 of 37 pictures at full sharpness, 3 clicks and typing logged, `check` 0.000% on all 3 marks. **Terminal:** a 45.4 s take of 6 commands (a colour progress bar, a 3 s wait, a server left running with `until`) at 1972 x 1212; 314 of 316 typed keys appear on the exact frame logged for them (2 a frame early); `check` 0.000% on 3 marks; home folder shown as `~`. **Phone:** this Mac has no Xcode (so no iOS Simulator), no idb and no Android SDK, so it was run only against stand-ins for `xcrun simctl`, idb and adb: the commands sent were right and in order, a tap found by its label landed in the label's middle, and the takes came out 804 x 1748 (iOS, 402 x 874 points) and 822 x 1828 (Android, 1080 x 2400 at 420 dpi); without them it stops with what to install. **Found and fixed:** the shared assembler read every picture on ffmpeg's default 1/25 s clock, so pictures were moved to the nearest 40 ms and those landing together were dropped (11 pictures 1/60 s apart: 5 survived; 9 of 11 pictures on exact frames landed a frame early or late); it now reads them on a 1/600 s clock (11 of 11 kept, 0 off); this affects every web take recorded before (a desktop scroll take kept 55 of 71 pictures before); WordPress's block editor was read as a loading placeholder and as something covering the page (its layout is named "interface-interface-skeleton"; it is now kept). **Not checked:** a real iOS Simulator or Android emulator (nothing recorded on a device), idb itself; a real company's staging site; WordPress mail to a test inbox (Playground sends none), multisite, translations; an Electron app with its debugging switched off; a real long-running install in a terminal (only a scripted progress bar); the engine showing a terminal or phone app take (the files match a web take's; `cursor.json` says `"input": "keyboard"` for terminals, which the engine does not know yet, and nothing in `engine/` was changed); web takes re-measured after the assembler fix (`seen_scroll.mjs` measures where each picture really scrolled, so it should still hold). |
| **7. Checks and delivery** | Freshness by picture, words and layout; readable after zoom; captions clear of UI; proof of source in the delivery pack | The checks catch a planted label change and a caption over a button<br>**Done 12 Nov 2026 (evening), tested on a practice page, Tulvo's boards take (check only, no new take) and the sample job; temporary practice brand and jobs removed after.** Built: **freshness by words and layout:** every mark now also saves `marks/<mark>.layout.json` (each named button, link, tab, field and heading with its role, name and box, plus the tracked things; private words left out), and `check` compares each mark three ways (`tools/capture/freshness.mjs`): the picture as before; the words as a set of labels (row order ignored, so Tulvo's own reshuffles are not changes), naming labels added, removed and renamed; and the layout, naming anything that moved or changed size by more than 3 px (things moving together are one line). `capture.mjs compare <job> <id> <take> <take>` does the same between two saved takes without Chrome. **Readable after zoom:** `tools/checks/text_size.mjs` reads the finished frame with tesseract at every click, hover, mark and reading hold of each capture in the film (placed through the engine's own plan, `tools/checks/lib/capture_place.mjs`) and at every on-screen text, and measures type size from the height of each word's ink; product words at the action against `--ui-floor` (4% by default) and also 3%, both reported, the owner to choose; film text against 2.6%. **Captions clear of UI:** `tools/checks/captions_clear.mjs` places the caption pill as `Captions.tsx` does (bottom, or top for a scene with `"captions": "top"`, the slot in tall frames) and checks it against the acted-on thing at every key moment and every tracked thing while a caption is up. **Proof of source:** `tools/film/sources.mjs` traces every product shot (shots.json `capture`, and captures the scene code plays) to its take's capture.json, checks the engine's copy is that take's recording, writes `deliver/sources.txt` and `sources.json`, and fails on a shot with no source; it and `check` are now steps in the delivery stage. Also built for item 12 of DESIGN.md: `tools/checks/flashes.py` and `tools/checks/energy_map.py`. A shot names its capture and placement in shots.json: `"capture": "capture/<id>"`, `"clip": { CaptureClip settings, "at", "place": {x, y, width} }`. Measured: **planted label change** (practice page, "New lead" renamed "Add lead", the page body moved down 40 px): `check` exited 1 and said `"New lead" became "Add lead"`, `the tracked thing "card" moved 40 px down`, `the button "Export" moved 4 px right` (it did, as the new label is narrower) and `the button "New lead" is now called "Add lead"`; picture 0.55%; unchanged, the same page gave no change on all three ways (0.000%). **Tulvo:** `check` on the boards take: no change on all 3 marks, picture 0.000%, words the same; layout compared for tracked things only (the take predates saved layouts). `compare` of takes 1 and 5: words the same although 4 rows came out in a different order; pictures 0.57 to 0.61% apart. **Planted caption over a button** (the boards take framed so the New button sat under a top caption): exit 1, "the caption "Then add a new card" sits over the pointer resting on "New" (91 x 45 px of it)"; framed normally: pass. Caption pill width measured on the sample render: 0.44 to 0.48 of the text size per letter; the check uses 0.52 so a near miss is reported. **Text size:** on type set at known sizes in Chrome (11 to 86 px, Inter and Instrument Sans), the measured size was within 2% for every line (one two-letter word 6% under); captions in the sample render measured 3.97 to 4.13% (designed 4.0%); half-size previews read small text about 14% too large, so the check is for full-size renders. On a full-size render of Tulvo's boards take filling the frame (the engine's GlueProbe, product-demo look, automatic camera; 471 frames, rendered under the lock): the sidebar link at the hover, camera at 1.00, measured 1.37% (Tulvo's 14 px sidebar type is 1.30%); at the click, camera pushed in to 2.00, 2.63% (2.59% expected), and 2.57% at the next mark (camera 1.96): all under both 4% and 3%, so the check failed (exit 1), as it should: 14 px product type needs a push past what the recording's sharpness allows, or a tighter crop, to reach 3%. Found and fixed: icons read as "88" or "oo" pulled the click down to 2.20%; one- and two-letter scraps and repeated characters are no longer words. The white "New" on Tulvo's black button was not read at all (tesseract reads dark on light), so those two moments say "no words read; look at the frame" instead of passing. **Proof of source:** the practice film's shot traced to take 5 (captured 2026-11-12 14:08, app.tulvo.io, the studio's window, Chrome 157); with the capture folder removed: exit 1, "NO SOURCE ... not in the job folder"; a scene-code reference to Tulvo's capture traced to take 5 and its engine copy matched. **Flashes:** the sample with 1.5 s of full-frame white flashing at 6 a second: exit 1 (6 flashes in a second over 100% of the frame); the sample and 26 earlier renders (product demos, all 20 joins): pass, the most any had was flicker over 3.8% of the frame. **Energy map:** a practice film (a still and a busy part of an earlier render, planned 1 then 4): pass (levels 1 and 4); the same two parts swapped (a scene planned calm rendered busy): exit 1, MORE, LESS and ORDER flags. The sample film itself is flagged: its placeholder scenes hardly move (0.07 to 0.11) against planned 3, 4 and 5. Tests: 59 unit tests (42 node, 17 Python: `node --test tools/capture/tests/*.test.mjs tools/checks/tests/*.test.mjs tools/film/tests/*.test.mjs`, `python3 -m unittest discover -s tools/checks/tests -p 'test_*.py'`), run by `setup/doctor.sh`. **Not checked:** a real WordPress site, phone or terminal take's words and layout (terminal and phone takes compare words only where `.txt` is saved, and save no layout); named things inside frames (iframes) of a page; a film rendered from shots.json with captures (none exists yet: the checks were run on a probe render and practice film files); caption contrast; red flashing; text in tall (9:16) frames measured in a render; the energy map on a finished real film with music. |
| **8. Other sizes** (built 12 Nov) | 9:16 and 1:1 by camera-follow, or a phone-size take | A wide take re-laid as 9:16 keeps every action in frame<br>**Built 12 Nov 2026, tested on Tulvo's boards take (take 5) with the link and the New button given as things (capture.json's step targets).** A `CaptureShot` in a 9:16, 1:1 or 4:5 composition re-lays its staging for the frame (`engine/src/kit/capture/relayout.ts`): full bleed for the social vertical look and the full screen, a card, a browser window or a generic phone frame for the others, stacked takes for two people and the montage; 3D and device stagings become a flat card (a screen that must be read is never tilted). The follow camera (`planFollow`) keeps the acted-on thing and the pointer inside the safe area with a 3.5% margin on every frame: it trails the pointer by 150 ms, moves one way per move, holds still on reading holds, never passes the recording's sharpness, lands with a spring that settles back once, and when the next move is longer than a close view holds it pulls back while the pointer rests (or tracks the move at one scale when that keeps everything in). On 9:16 the safe area is the band Instagram, TikTok and YouTube Shorts all leave free (Meta's 14% top and 35% bottom, the right-hand buttons), less the caption slot; captions now sit at that band's bottom in tall frames. `SafeAreaOverlay` draws the three apps' buttons and captions over previews only. A phone-size take fills the 9:16 frame with the touch pointer and is never cropped at its sides; a phone frame is an option. The looks pick their vertical version by themselves (social vertical full bleed; tutorial in a browser window; documentary and montage follow without springs when one still scale would leave the page a thin strip). Part B's product animations and phase 5's joins take their places through the same camera (each join side is planned with its drawn region). Found and fixed: a page box of fractional width was rounded by the browser before the camera scaled it, which put the far side of a card's page up to 5 px off; the page is now laid out at its own pixel size and scaled once (all captures, any size). 16 library entries (`capture-relayout`) with half-size previews; contact sheet `library/motion/relayout-sheet.jpg`; `tools/checks/capture_relayout.mjs` measures it; `capture_transitions.mjs --size 9:16`; `capture_motion.mjs` takes `things` and `region`. Measured on a full-size 9:16 render of the social vertical look (472 frames): the acted-on thing (343 frames) and the pointer (344 frames) never left the safe area with its 38 px margin (least room 0.0 and 7.0 px past the margin); in the render the thing sat 0.8 to 1.4 px from where the plan put it (four moments); 0 camera jumps (`capture_relayout`, `capture_motion`); `smoothness.py` flagged one jump at 3.15 s, Tulvo's own board replacing its loading placeholder in one frame (it is at 7.28 s in the raw recording; the camera is still there); follows half way 133 ms behind the pointer, never ahead; closest view 2.0 frame px per page px (the recording's limit); at the click the link's words (clear of the pointer) are 10 page px tall: 20 px in the frame, 1.04% of its height (21 px measured in the render; the whole label with descenders 27 px, 1.41%); that is the most the recording's sharpness allows for 14 px UI text in a 1080-wide frame (1:1 1.85%, 4:5 1.48%), below the 2.6% craft minimum, so read-critical UI text in vertical needs a phone-size take or a rebuilt screen. Instagram, TikTok and Shorts: all 210 key-moment frames clear. The plan check also passed for product demo, tutorial, calm, launch and documentary in 9:16, the phone frame, 1:1 and 4:5, and the phone-size stand-in. Joins in 9:16: zoom through, shared element and match cut kept the pointer and the clicked thing within 0.01 px. A full-size 9:16 card render: the thing within 1.0 px of the plan, no jumps. The 16 half-size previews and the re-rendered 16:9 tall crop: `smoothness.py` found no jumps or judder in any; on the ten single-region previews the plan check passed and the thing sat within 2.1 px of the plan in the picture.<br>**Not checked:** a real phone-size take (tested on a stand-in cropped from the wide take, at 2x not 3x), captions at their real length in 9:16 (`captions.mjs` still splits lines at 42 characters, too wide for the slot at 4% text size), the 16:9 renders of earlier phases again after the page-box fix (same maths, sub-pixel differences only), any preview watched frame by frame (contact sheet only), a take with typing, a drag or a scroll re-laid out, the platforms' zones against the live apps (taken from their guidance). |

Phases 2 to 4 give the biggest jump in quality and are worth doing before any real video. Phases 5 to 8 can follow the proving run.

---

## 12. Decisions made by the owner (11 Nov 2026, night)

1. **Browsers:** yes. Recording goes through the person's own Chrome (Playwright extension) by default, with the studio's own window for freshness checks and exact retakes. Claude's own browser pane and Claude in Chrome may both be used too, for walking flows, planning and stills, with the person's Chrome profile.
2. **Demo sites:** the studio creates the local demo sites itself (WordPress Playground or Local for WordPress, and the equivalent for other products), from recipes. A company may also give its own environment (a staging site, a demo account) instead; the recipe then only points at it.
3. **AI answers:** yes, record a real answer once and replay it for retakes, labelled with its date.
4. **Frozen clock:** yes as the default, switchable per video (the owner was unsure; a video that needs the real date turns it off in its capture script).
5. **Test products:** Tulvo, the practice page, and a WordPress plugin demo site, but WordPress is not the focus. A company can bring its own environment. Before any company's first video, the studio runs a product discovery (context, who the product is for, positioning, key flows); see DESIGN.md section 14, "Product discovery".
6. **Build order:** phases 2, 3 and 4 first, then the rest.
7. **Scope:** build all the features together across product kinds; keep the WordPress recipe light (a working recipe, not a deep WordPress toolkit).
