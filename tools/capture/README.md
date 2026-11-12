# Product capture

Records a brand's web product for a video. You write the steps in plain words (open this page, click New, type a name, save), and the tool does them in Google Chrome at a person's pace while it records. You get a sharp video of the real product, the pointer's path to draw a smooth branded cursor on top, where the things you name sit in every frame, and a still of every moment you name.

It works for any brand set up in `brands/`, and for many kinds of product: web apps, AI products, WordPress plugins (on a demo site the studio builds itself), shops, Chrome extensions, the phone version of a web product, desktop apps built with Electron, phone apps and command-line tools (see "Product kinds"). Web products are filmed in the Google Chrome already on your Mac: either your own Chrome, with the sign-ins you already have (through a free extension, see below), or a Chrome window the studio keeps for itself. Every kind hands the engine the same files: a sharp recording, the pointer, taps or typed keys, the marks and where it came from.

## What you need

- Google Chrome, installed the usual way.
- The tool itself: `bash setup/install.sh` sets it up. The health check (`bash setup/doctor.sh`) says if it is missing.
- The brand's product file, `brands/<brand>/product/capture.json`: where the product lives, the demo account, the clean screen, the demo date and time, and what must never be filmed. How to fill it in is in `brands/_template/product/README.md`.

## Which Chrome records

| | Your own Chrome (`--browser mine`) | The studio's own window (`--browser studio`) |
|---|---|---|
| Sign-in | The one you already have | One sign-in per brand, by hand (below) |
| Used by default for | `run`, `rehearse`, `dry`, `show` | `check` (freshness checks), and takes that must match exactly across days |
| Needs | The Playwright Extension, once (below), and you at the Mac to allow it | Nothing more |

Add `--browser studio` or `--browser mine` to any command to choose. A brand can change its own default in its `capture.json` with `"browser": "studio"` (or `"mine"`), and the whole studio with `"capture_browser"` in `studio.json`.

## Record through your own Chrome

The tool can work in your everyday Chrome, so it uses the sign-ins and demo workspace you already have. It does this through Microsoft's free Playwright Extension (the one Playwright's own AI tools use).

**Once, to set it up:**

1. In Chrome, open the [Playwright Extension in the Chrome Web Store](https://chromewebstore.google.com/detail/playwright-extension/mmlmfjhmonkocbjadbfplnigmagldckm) and click "Add to Chrome". It is free and made by Microsoft.
2. Optional: pin it (the puzzle icon next to the address bar, then the pin), so you can see when it is connected.
3. Check it works: `node tools/capture/capture.mjs connect`. Chrome shows a "Playwright Extension" page; click "Allow & select" next to any tab. The tool says it is connected, opens a tab of its own for a moment and closes it again.
4. If you use more than one Chrome profile, the extension must be in the one that opens. To name another profile, add `--chrome-profile "Profile 2"` (the last part of "Profile Path" on the page `chrome://version`), or put `"chrome_profile": "Profile 2"` in the brand's `capture.json`.

**Every time you record:**

1. Run the command (`run`, `rehearse`, `dry` or `show`). Chrome shows the "Playwright Extension" page.
2. Click "Allow & select" next to any tab. The tool opens a new tab of its own next to it and does everything there. It never touches the tab you picked, your other tabs, your bookmarks, history, passwords or cookies.
3. Keep that Chrome window in front and uncovered, and keep your mouse off it, until the tool says it is done. You can use other apps on another screen.
4. When it is done, the tool closes its own tab and lets go of Chrome. Chrome's "being controlled" bar goes away.

**What the tool does about your Chrome's own settings, for the take only:**

- **Page size:** the page is locked to 1920 x 1080 at double sharpness, whatever size your window is, so the "being controlled" bar and your window size do not matter. If your window is smaller, you may see only part of the page while it records; the recording has all of it.
- **Zoom:** if your Chrome zoom for the product is not 100% (say 110%), the tool makes up for it, so the take looks exactly as at 100%. Your zoom setting is not changed.
- **Your extensions:** things your own extensions draw on the page (password manager icons in fields, grammar checkers, shopping and translation pop-ups, anything an extension adds) are found and hidden before and during the take, and listed when the take starts. If one cannot be hidden, or something changes the whole page (Chrome translating it, an extension recolouring it such as Dark Reader), the tool stops and names it: pause it on that site and run again.
- **Autofill:** fields are asked not to offer your saved addresses and cards. Chrome's own suggestion pop-ups never appear in a recording anyway.
- **Light or dark, language, time zone, demo clock:** set as the script or brand says, in the tool's tab only.
- **Afterwards:** the tool's own tab closes, and everything set for the take goes with it. Your Chrome is as it was.

If it does not connect, the tool stops after 3 minutes (`--wait 60` changes that) with these steps: install the extension, allow a tab, check the profile, update the extension, or use `--browser studio`.

## Sign in once (the studio's own window)

```
node tools/capture/capture.mjs signin <brand>
```

A Chrome window opens at the product. Sign in by hand, open the demo account, then close the window. That is all.

- The tool never types, reads or keeps a password or a sign-in code. You type them, in Chrome.
- The sign-in is kept on this Mac only, in `.capture/<brand>/`. It is never synced, shared or put in GitHub.
- When a sign-in runs out, a capture stops and tells you to do this again.
- If the product shows a "prove you are human" test, the tool stops and asks. It never solves or skips one.

## Write the steps

Each capture is one file in the job: `jobs/<job>/capture/<name>.json`. It is a list of steps, done in order. The first step opens a page.

```json
[
  {"open": "/"},
  {"click": "New"},
  {"mark": "form-open"},
  {"type": "Morrowby Coffee", "into": "Name"},
  {"click": "Save", "in": "New lead"},
  {"wait for": "Saved"},
  {"mark": "lead-added"}
]
```

Things are found by the words on them or their label, as a person would read them. Capital letters do not matter. When two things have the same words, add `in` (the panel, list or dialog it is in) or `near` (words next to it).

| Step | What it does |
|---|---|
| `{"open": "/leads"}` | Opens a page of the product. A full address (`https://...`) opens that site instead; the tool goes nowhere else. |
| `{"click": "New"}` | Moves the pointer there on a smooth curve and clicks. |
| `{"click": "Save", "in": "New lead"}` | The one inside the panel, list, row or dialog with that title. |
| `{"click": "Edit", "near": "Morrowby"}` | The one closest to those words. |
| `{"double-click": "Morrowby"}` | Clicks twice, quickly. |
| `{"right-click": "Morrowby"}` | Opens the menu the product draws. The system's own right-click menu never appears in a recording. |
| `{"type": "Morrowby Coffee", "into": "Name"}` | Clicks into the field called Name and types, key by key, at a person's pace. Without `into` it types where the cursor already is. |
| `{"paste": "A long prompt...", "into": "Ask"}` | Puts a long text in at once, for prompts and long notes. The engine can still show it typed at speed. |
| `{"press": "Enter"}` | A key: Enter, Tab, Escape, ArrowDown and so on. Shortcuts work too, like `"Meta+K"`; they are logged so the engine can show them as key caps. |
| `{"select": "Medium", "from": "Size"}` | Picks an option from the list called Size. If the list is one the system draws (a plain drop-down), its open menu is not in the recording, only the result, and the tool warns you. |
| `{"check": "Remember me"}` | Ticks a box, if it is not ticked already. Add `"off": true` to clear it. |
| `{"toggle": "Dark mode"}` | Flips a switch. |
| `{"drag": "Morrowby", "to": "Done"}` | Presses on a thing and drags it to a place, on an eased path in small moves, then lets go. `"by": [120, 0]` moves it right 120 page pixels instead (for sliders). The path is logged. |
| `{"hover": "Leads"}` | Rests the pointer on something, so its hover look and tooltip show. |
| `{"scroll": 400}` | Scrolls down 400 page pixels, smoothly, frame by frame along an eased curve (never jumpy wheel steps). A minus number scrolls up. Add `"in": "Messages"` to scroll a panel, and `"seconds": 1.5` to set how long it takes. |
| `{"scroll": "Pricing"}` | Scrolls smoothly until that thing sits in the middle of the screen. |
| `{"upload": "files/logo.png", "into": "Add a logo"}` | Puts a file from the job folder into a file field. The pointer clicks the button or label; the system's file window never appears. |
| `{"wait": 1.2}` | Holds still for 1.2 seconds. |
| `{"wait for": "Saved"}` | Waits until those words are on screen. Add `"gone": true` to wait until they go. |
| `{"wait for": "Export", "thing": true}` | Waits until a button, field or other thing called Export appears (or goes, with `"gone": true`). |
| `{"wait for": "settled"}` | Waits until the page has settled (see "Ready and settled" below). |
| `{"wait for": "stopped", "in": "Answer"}` | Waits until the text in the area called Answer stops changing: for AI answers that stream in word by word. The area is found by its label, its heading, or a CSS selector like `"#answer"`. `"quiet": 1.5` sets how long the text must stay the same (1 second by default). |
| `{"switch": "new"}` | Moves to the newest tab or pop-up window the product opened, and records that from now on. `{"switch": 1}` goes back to the first tab. |
| `{"switch": "frame", "to": "Payment"}` | Works inside a frame on the page (found by its title or name, or a CSS selector). `{"switch": "page"}` comes back out. |
| `{"back": true}`, `{"reload": true}` | The browser's back button, and reload. |
| `{"size": "phone"}` | Changes the page size mid-take: `desktop` (1920 x 1080), `laptop`, `tablet`, `phone` (390 x 844), `phone large` (430 x 932), or `[width, height]`. A smaller page sits in the middle of the recording on black. Touch is not switched on mid-take: for a phone take with touch, start the whole take at phone size (see "Phone-size web"). |
| `{"theme": "dark"}` | Switches the page to light or dark. |
| `{"mark": "lead-added"}` | A named moment. A full-sharpness still and the words on screen are saved, and `check` compares them later. |
| `{"track": "Save"}` | From now on, logs where that thing is and how big, in every frame, in `tracks.json`. `"css": "#card-1"` finds it by a selector instead; `"name"` names it. |
| `{"mask": "jo@client.com"}` | Blurs those words for the whole take, in the recording too, wherever they appear. `"css": "#billing-box"` blurs a thing by selector; `"thing": true` blurs the thing called that from this step on. |
| `{"line": "v3"}` | Ties the next step to voice line v3, so the engine can land it on the words. |
| `{"layer": "#summary", "name": "card"}` | Saves that one thing on its own, as a see-through picture at full sharpness, with where it was. For lifting a card off the screen or flying it into the next scene. Found by its words or a CSS selector. See "Layers and snapshots". |
| `{"snapshot": "Summary", "name": "stats"}` | Saves the code of that area (its HTML and the CSS that styles it), so the engine can move single rows or numbers in it. Found by its label, heading or a CSS selector. See "Layers and snapshots". |
| `{"as": "customer", "page": "/inbox"}` | The next steps happen in the second demo user's window, signed in as that user. `"page"` (first time only) is where their window opens. `{"as": "main"}` goes back to the first user. See "Two demo users". |
| `{"open": "extension:popup"}` | Opens the brand's Chrome extension's popup (or `"extension:side panel"`) as a page, at its real size. See "Browser extensions". |

Steps that wait take `"limit"` (seconds). `node tools/capture/capture.mjs steps` prints this list.

A `type` step can also take `"clear": true`, to empty the field before typing (for a field that already had words in it).

### Script options

A script can also be written as `{ "steps": [...] }` with options next to the steps. Each one overrides the brand's setting for this capture only.

| Option | What it sets |
|---|---|
| `"clock": "2026-11-20 10:30"` | The demo date and time. `"clock": false` uses the real time (for a video that needs today's date). |
| `"theme": "dark"` | Light or dark. |
| `"language": "en"`, `"region": "GB"` | The language and region the page is shown in (dates, numbers, the browser's language). |
| `"time_zone": "Europe/London"` | The time zone. |
| `"reduced_motion": true` | Asks the product for reduced motion. Off by default, so the product moves as people see it. |
| `"safe": ["Morrowby Coffee"]` | More made-up names and e-mails that are fine to show, on top of the brand's list. |
| `"settle_limit": 4`, `"ready_limit": 20` | How long to wait for the page to settle after a step, and to be ready when a page opens (seconds). |
| `"start": {"x": 1200, "y": 700}` | Where the pointer starts. |
| `"kind": "phone web"` | The kind of product for this capture, if it differs from the brand's (see "Product kinds"). |
| `"size": "phone"`, `"touch": true` | The page size the take starts at, and touch on or off. |

### What the tool refuses

- Any step aimed at a password or sign-in code field.
- Any page or text the brand lists under "never show" (for example billing pages, a chart that shows wrong numbers). It checks every page the take visits, every few tenths of a second while recording, and at every mark. A match stops the take.
- Leaving the product's site. A link that goes elsewhere is held back and the capture stops. Tabs and pop-up windows the product opens on its own site are fine.
- A sign-in screen. It stops and says: sign in first with `capture.mjs signin <brand>`.
- Anything unexpected covering the page when a page opens: a dialog, an overlay, a widget from another site, a cookie banner nobody listed. It stops with a still of it, boxed in red, and asks you to add it to the brand's clean-screen list.

## Record by showing

Instead of writing the steps, show them once:

```
node tools/capture/capture.mjs show jobs/<job> <name>
```

1. The product opens (in a new tab in your own Chrome, or with `--browser studio` in the studio's window), at the page the script already starts on, or `/`, or `--start /leads`.
2. Click, type and scroll through the flow as you would for a viewer. Take your time: pauses are not kept, and the take replays it at a person's pace.
3. Press Control+M at each moment the film should be able to point at. Each one becomes a mark (`mark-1`, `mark-2` ...). `--mark-key` picks another key.
4. Close the tab (or window) when you are done, or press Ctrl+C in the terminal.

The tool writes the steps into `jobs/<job>/capture/<name>.json` (an old script is kept next to it as `<name>.json.before-show`) and prints them for you to read. It writes:

- clicks, by the words on the thing or its label, with `near` and words next to it when two things share a name
- typing, by the field's label, with only the final text (your corrections are not kept)
- keys such as Enter, Escape, Tab, arrows and shortcuts; ticks, switches and lists; drags
- scrolls, one step per scroll once it comes to rest
- hovers you rested on for most of a second without clicking
- pages you opened by typing an address, back and reload

It leaves out, and says how many: stray clicks on nothing that changed anything, menus or panels opened and closed again at once, pages opened and left again straight away, hovers just before a click on the same thing, repeated clicks, and scrolls that ended where they began.

It never reads what you type into a password or sign-in code field: it only notes that one was used, and writes nothing. Sign in before you show the flow.

Then read the script, rename the marks to say what each moment is, and watch it played back with `rehearse`. Things with no words, label or id (an unlabelled icon) cannot be found by words: the tool says so, and you add those steps by hand, for example with a CSS selector like `{"click": "#settings-button"}`.

## Product kinds

One word in the brand's `capture.json`, `"kind"`, fills sensible defaults for that kind of product. Anything the brand or the script sets itself wins; the kind's lists are added to the brand's own. `node tools/capture/capture.mjs kinds` lists them.

| Kind | What it sets |
|---|---|
| `web app` | Desktop page (1920 x 1080), the usual waits. The default when no kind is named. |
| `ai product` | Longer waits (30 seconds to be ready, 6 to settle), "text stopped changing" waits that allow 1.5 seconds of quiet and up to 90 seconds, and AI answers recorded once and replayed for retakes, from the product's `/api/` addresses unless the brand names its own. |
| `wordpress` | Hides other plugins' admin notices, update nags and update counts; closes the block editor's welcome guide; keeps the full-screen block editor (it is the product, not something covering it); knows `/wp-login.php` is the sign-in page; never films the updates and site health pages; ignores WordPress's background calls (heartbeat, cron). With a blueprint, the studio builds the demo site itself (see "WordPress demo sites"). |
| `shop` | Any card number on screen that is not a payment provider's published test card stops the take. Ignores payment providers' background calls. |
| `extension` | The studio's own window, with the brand's extension loaded from its folder (see "Browser extensions"). |
| `phone web` | Phone size (390 x 844) with touch on, in the studio's own window (see "Phone-size web"). |
| `desktop` | A desktop app built with Electron, opened from its path and recorded like a page at its own window size (see "Desktop apps"). |
| `phone app` | A phone app in the iOS Simulator or the Android emulator, by touch, with a clean status bar (see "Phone apps"). |
| `command line` | A command-line tool: the commands run for real, and the studio draws the terminal (see "Command-line tools"). |

## AI answers

An AI product gives a different answer every time. So the first good take records the product's real answers, and every retake replays them: the same words, streamed in piece by piece at the same moments, without asking the product's AI again.

- **What is recorded:** only the product's own addresses the brand names in `capture.json` (`"ai": { "answers": ["/api/chat"] }`; the `ai product` kind starts from `/api/`). Sign-in, token, session, account and payment addresses are never recorded, whatever the list says. It uses Playwright's own network recording (a HAR file), plus the moment each piece of a streamed answer arrived, from Chrome's network log.
- **Nothing secret is kept:** every token, cookie, key and authorization value is removed before anything is saved, in what was sent and what came back.
- **Where:** `jobs/<job>/capture/<name>/answers/`: `answers.har` (the cleaned recording) and `answers.json` (each answer, in pieces with their times, and the date the real answer was made).
- **Labelled with its date:** each take's `capture.json` says `"ai_answers"`: `recorded` (and when) or `replayed` (and the date the real answer was made). Label the footage with that date.
- **When the product changes:** if the product asks for something the saved answers do not cover (it changed how it asks, or the script asks something else), the replay is refused with a plain message, the old answers are kept aside (`answers.before-<date>/`), and a fresh answer is recorded in the same run.
- **By hand:** `node tools/capture/capture.mjs answers jobs/<job> <name>` says what is saved and from when, with each answer's words. `--forget` sets them aside; `run ... --fresh-answers` records new ones.
- **Read before use:** a person reads every generated word before the footage goes into a scene. Anything wrong, odd or unflattering means a new answer, not an edit.
- The first take of an answer is recorded in the studio's own window. Retakes can replay in either Chrome. Answers fetched by the page's own `fetch` stream at their real pace; answers fetched another way arrive whole, after the same wait.

## Layers and snapshots

Two steps save one part of the screen for the engine, besides the recording.

**`layer`** saves one thing on its own as a see-through PNG at full sharpness: the page's background and everything else on it are hidden for a moment, so only the thing (with its own shadow and rounded corners) is in the picture. Those few pictures are left out of the recording (the frame before simply lasts longer), and the moment is logged as a wait the engine can cut. Private words inside it are blurred. It writes, in the take's `parts/layers/`:

| File | What |
|---|---|
| `<name>.png` | The thing alone, twice the page's sharpness, transparent around it. |
| `<name>.json` | `box`: the thing itself as `[x, y, width, height]` in page pixels from the top left of the window. `picture.box`: the area the PNG covers (a little larger, for the shadow). Also the time `t` on the recording's clock, the page scroll, the page size and the corner radius. |

**`snapshot`** saves an area's code: its HTML and only the CSS rules that style it, made to stand on its own. Every CSS rule is scoped to one class (`.studio-snap-<name>`), the same way the old screen kit's `scope-css` did, so the product's look is kept inside the snapshot and nothing outside it is touched; media queries are decided for the page size it was taken at, animation names are renamed to the snapshot's own, and pictures keep their full addresses. Scripts are removed, field values kept, and private words replaced with `[blurred]`. Nothing on screen changes while it is taken. It writes, in `parts/snapshots/`:

| File | What |
|---|---|
| `<name>.html` | A page that shows the area on its own, as it looked. |
| `<name>.json` | `box`, `t`, the page scroll and size, the `scope` class, how many CSS rules came with it, any style sheet from another site that could not be read, and `parts`: every row (`li`, `tr`, rows in grids and lists), number (like `128`, `42%`, `$9,400`) and line of words, each with an `id` (the same as its `data-studio-part` in the HTML), its `kind`, its words and its `box` inside the area. The engine moves these one by one. |

Both are copied with the best take to the engine.

## Two demo users

For moments with two people (a customer and a vendor, a teammate's comment arriving), a script can switch between two signed-in windows. Both are recorded the whole time, on one clock.

1. Sign in the second user once, by hand, in a window of their own: `node tools/capture/capture.mjs signin <brand> --as customer`. Sign in as that demo user, not as yourself. It is kept apart from the brand's own sign-in, in `.capture/<brand>/as/customer/`.
2. In the script, `{"as": "customer", "page": "/inbox"}` moves to their window (opened at that page before the take starts); the steps after it happen there. `{"as": "main"}` comes back to the first user.

The take writes `recording.mp4` and `cursor.json` for the first user, `recording-customer.mp4` and `cursor-customer.json` for the second (each with its own pointer and events), and `events.json`: every event of both windows in one list, on one clock, each with the user it belongs to. The engine's split staging can then show them side by side, moving together. Two-user takes run in the studio's own window.

## Browser extensions

The studio's own Chrome window can load the brand's extension from its folder (`"extension": { "folder": "..." }` in `capture.json`, the unpacked extension with `manifest.json`), for takes that film it (`"kind": "extension"`, or a step that opens it). Chrome no longer loads extensions from the command line, so it is loaded through Chrome's own tools connection, for that window only.

- `{"open": "extension:popup"}` opens its popup as a page in its own tab, at the popup's real size: as big as its content, as Chrome sizes a popup (at most 800 x 600). When the content grows or shrinks after a step, the page follows it, as a real popup does, and the recording is as big as the popup ever was, with the popup hanging from the top.
- `{"open": "extension:side panel"}` opens its side panel, 360 x 900 unless the brand sets `"panel_size"`.
- `capture.json` marks the take as an extension popup (or side panel), with the extension's name and version, so the engine frames it as one; the browser around it is not in the recording.
- A popup opened as a page is its own tab, so an extension that asks "which tab am I on?" sees its own popup. Film what the popup does on our own demo pages only.

## Phone-size web

`"kind": "phone web"` (or `"size": "phone", "touch": true`) starts the take at 390 x 844 with touch on: the page gets touch events, no hover (`hover: none`, so hover-only menus never open), and a phone browser's identity. The recording is the phone page at double sharpness (780 x 1688).

- `click` steps are taps (`double-click` a double tap, `right-click` a long press); `drag` is a long press and a drag. `hover` steps stop the take: a phone has no hover.
- `scroll` steps scroll the page smoothly, frame by frame as always, and log a swipe: the finger's path, moving with the page, on the same frames.
- `cursor.json` says `"input": "touch"`; taps are click events with `"gesture": "tap"`, and swipes are `swipe` events with the finger's `path`, so the engine's touch pointer draws them.
- Phone-size takes run in the studio's own window.

## WordPress demo sites

The studio builds a throwaway WordPress site for every take, on this Mac only, from a recipe the brand keeps: `brands/<brand>/product/blueprint.json`, a WordPress Playground blueprint (WordPress Playground is WordPress's own free tool for sites that start fresh and leave nothing behind). The site is built before Chrome opens, the take films it, and it is torn down after. So every take starts from exactly the same site.

```json
{
  "preferredVersions": { "php": "8.3", "wp": "latest" },
  "plugins": ["duplicate-post", "files/our-plugin.zip"],
  "users": [ { "login": "ana", "role": "editor", "name": "Ana Ruiz" } ],
  "steps": [ { "step": "setSiteOptions", "options": { "blogname": "Morrowby Coffee" } } ]
}
```

- **WordPress and PHP version:** `preferredVersions`.
- **Plugins:** a word is a free plugin from wordpress.org (its address name, like `duplicate-post`); a path ending in `.zip` is the brand's own plugin, next to the blueprint. Both are switched on.
- **Theme, demo content, settings:** any WordPress Playground step in `steps` (`installTheme`, `importWxr` for posts and products, `setSiteOptions`, `runPHP` and the rest; the Playground's own guide lists them). Use only the brand's cleared names in demo content.
- **Demo users, one per role:** `users`, each with `login`, `role` and a made-up `name`. Never write a password: the demo site gives each a long random one nobody sees.
- **Signing in:** the take signs its demo user in by itself, from a link with the site's own random key (`admin` unless `capture.json` says `"site": { "signin_as": "ana" }`). An `{"as": "ana"}` step opens a second window signed in as that user (a login or a role). No password is typed, read or kept, and there is nothing to sign in to by hand.
- **A clean admin, by default:** besides the `wordpress` kind's hidden notices, the demo site switches off update nags and counts, the admin e-mail check and automatic updates, closes the block editor's welcome guides, and shows the user's name without "Howdy".
- **Where it runs:** `http://127.0.0.1:9400` (or the next free port), only while the take runs. The take's `capture.json` says `"source"`: built from which blueprint, which WordPress, PHP, plugins and users, and how long the build took.
- **The first time:** the studio fetches WordPress Playground through npx, about 1 GB, once, into `.capture/npm-cache` (never synced), and WordPress itself. After that a site takes under a minute.
- **To look around the site yourself,** write steps against it, or record by showing: `node tools/capture/capture.mjs site <brand>` builds it and keeps it up until you press Ctrl+C, and prints a sign-in link for each demo user.

**Bring your own environment.** A company may give a staging or local site instead. Put its address in `capture.json` (`"address": "https://staging.example.com"`), leave out the blueprint (or write `"site": "own"`), and sign in once by hand as for any web product (`capture.mjs signin <brand>`, and `--as <role>` for each role). Never use a real, live site's details.

Not built: e-mail from the demo site to a test inbox (WordPress Playground cannot send mail; use a staging site with Mailpit, see "Emails the product sends"), multisite, and translations.

## Desktop apps

`"kind": "desktop"` films a desktop app built with Electron (Slack, VS Code, Notion and many others are). The tool opens the app through Playwright's Electron support and records its window the same way it records a page: sharp, frame by frame, with the pointer's path, clicks, typing and marks.

```json
{ "kind": "desktop", "app": { "path": "/Applications/Tiny Notes.app" } }
```

- `"path"` is the app (`.app`) or its source folder (the one with `package.json`, with Electron installed in it). `"args"` adds anything the app needs on start.
- The first step is `{"open": "app"}`: the app's own window, as it opened (it is loaded once more so the clean screen and the frozen clock apply). The steps after it are the usual ones: click, type, press, scroll, wait for, mark.
- The recording is the window's own size at double sharpness (an app window of 1100 x 688 gives 2200 x 1376), unless `"size"` says otherwise.
- The app's window opens on screen: keep your own mouse off it.
- Not for native Mac apps (not Electron) or Electron apps whose makers switched off the connection tools use: the tool says so; record those by hand with Cap.

## Phone apps

`"kind": "phone app"` films an app in the iOS Simulator or the Android emulator on this Mac.

```json
{ "kind": "phone app", "phone": { "platform": "ios", "app": "com.example.app", "install": "build/Example.app", "device": "iPhone 17 Pro" } }
```

The steps:

| Step | What it does |
|---|---|
| `{"open": "app"}` | Opens the brand's app (the first step, before the recording starts). `"app:com.other.app"` opens another; a link (`https://...`, `myapp://inbox`) opens that. |
| `{"tap": "Sign up"}` | Taps the thing with those words (its accessibility label). `{"tap": [200, 640]}` taps a place in screen points. `"hold": 0.8` makes it a long press. |
| `{"type": "Ana Ruiz"}` | Types into the field that has focus, key by key. Never into a password or code field. |
| `{"swipe": "up"}` | Up, down, left or right, or `[from x, from y, to x, to y]` in screen points. |
| `{"press": "home"}` | home, back (Android), enter, lock. |
| `{"wait": 1.5}`, `{"wait for": "Welcome"}` | Holds, or waits until those words are on screen. |
| `{"mark": "signed-up"}`, `{"line": "v2"}` | A named moment with a sharp still; the voice line the next step belongs to. |

- The status bar is cleaned before the take (9:41, full battery and signal) and put back after, and light or dark is set.
- The recording is the phone's screen at twice its points (an iPhone of 402 x 874 points gives 804 x 1748), 60 frames a second, from the device's own recording. `cursor.json` says `"input": "touch"`, with taps, swipes (with the finger's path) and every typed key's time, like a phone-size web take.
- **iOS** needs Xcode (free, about 15 GB, from the Mac App Store). The simulator itself cannot tap or type, so taps, typing, swipes and finding things by their words also need idb, Meta's free iOS tool: `brew tap facebook/fb && brew install idb-companion`, then `pip3 install fb-idb`. Without idb a take can open the app or a link, wait and mark.
- **Android** needs Android Studio (free) with a virtual device started in its Device Manager. Positions are in dp (screen pixels divided by the screen's scale). A take can be at most 3 minutes (Android's own recorder stops there).
- The health check says which of these this Mac has.

## Command-line tools

`"kind": "command line"` films a terminal. The commands in the script run for real, each in a real terminal session (so colours, progress bars and the terminal's width are as a person sees them), in a fresh folder of their own. Then the studio draws the session, frame by frame, at double sharpness, with xterm.js (the terminal inside VS Code) in Chrome. No VHS or other install is needed.

| Step | What it does |
|---|---|
| `{"open": "terminal"}` | Optional first step. |
| `{"run": "npm init -y"}` | Types the command at a person's pace, presses Enter, and waits until it ends ("limit": seconds, 120 by default). |
| `{"run": "npm run dev", "until": "ready"}` | For a command that keeps running (a server): waits until those words appear, then carries on while it runs. It is stopped at the end of the take. |
| `{"type": "git push"}` then `{"press": "Enter"}` | The same as `run`, in two steps (to mark the moment before Enter). |
| `{"wait": 1.5}`, `{"wait for": "Done"}` | Holds, or waits until those words appear. |
| `{"clear": true}` | Clears the screen, as Cmd+K does. |
| `{"mark": "installed"}`, `{"line": "v2"}` | A named moment with a sharp still and the words on screen; the voice line the next step belongs to. |

- Set the terminal in the brand's `capture.json` (`"terminal": { ... }`) or in the script: `columns` and `rows` (96 x 26 by default), `theme` (`dark` or `light`), `font_size`, `prompt` (the folder's name and `$` by default), `folder` (a folder of the brand's demo files, copied fresh for every take) and `env`.
- Your home folder shows as `~` and the take's own folder as `~/demo`. A real-looking e-mail address in the output is flagged for a person.
- The tool never runs `sudo`, and stops a command that asks for a password or a code. Commands that wait for someone to answer a question do not suit a take: give them the flag that answers it (like `-y`).
- `cursor.json` has no pointer: every typed key's time (for typing sounds), each Enter, each command with when it ran and its exit code, and a `wait` the engine may speed up wherever a command worked quietly for more than 2 seconds. The take also keeps `terminal.cast`, the whole session in the asciinema format.
- `dry` runs the commands without drawing; `check` runs them again and compares the marks.

## Emails the product sends

```
node tools/capture/capture.mjs email jobs/<job> <name> --folder <folder of .eml files>
node tools/capture/capture.mjs email jobs/<job> <name> --mailpit
node tools/capture/capture.mjs email jobs/<job> <name> --file welcome.eml
```

Takes one e-mail the product sent, from a local test inbox, and turns it into pictures for the engine's mail frame. Never a real inbox.

- **Where from:** `--file` (a `.eml` or `.html` file), `--folder` (the newest `.eml` in it; `--pick "Order shipped"` picks the one that mentions those words), or `--mailpit` (the newest in Mailpit on this Mac, at `http://localhost:8025` unless another local address follows). A brand can set its own in `capture.json`: `"email": { "folder": "emails" }` or `{ "mailpit": "http://localhost:8025" }`.
- **Shown safely:** the e-mail is shown in the studio's Chrome at a set size (`--size 800x1000`, page pixels), with its own pictures from inside the e-mail and nothing loaded from the internet (pictures in e-mails often tell the sender it was opened; `--images` allows them).
- **Privacy:** the same scan as a take's marks: e-mail addresses, phone numbers and names not on the brand's safe list are blurred, never-show words are blurred and listed, and an address in the e-mail's header that is not on the safe list is left out.
- **What it writes** in `jobs/<job>/capture/<name>/email/`: `still.png` (the first screen, double sharpness), `full.png` (the whole e-mail), `recording.mp4` (rests 1 second, scrolls smoothly to the end, rests again; `--seconds 6`), `email.json` (subject, from, to, date, size, and the privacy flags), and `warnings.txt` when there is something to read. It is also copied to the engine. In a film, `CaptureShot` with the `mail` staging draws the frame, with the e-mail's from and subject.

**Starting Mailpit.** Mailpit is a free, open-source test inbox: a local site sends its e-mails to it and they are never delivered. The studio does not install it. Start it when a video needs e-mails, either with Docker:

```
docker run -d --name mailpit -p 8025:8025 -p 1025:1025 axllent/mailpit
```

or by downloading its single program from github.com/axllent/mailpit/releases and running `./mailpit`. Then point the demo site's outgoing mail at `localhost`, port 1025 (for WordPress, a small SMTP plugin does it), and open `http://localhost:8025` to see what arrived. Stop it with `docker stop mailpit` (or Ctrl+C).

## Demo data: setup and tidy

Steps that add something to the demo account (a new lead, a row on a board) add it again on every take, and the rows pile up. A brand can name two scripts in its `capture.json` that run around every take:

```json
"recipes": { "setup": "recipes/setup.json", "tidy": "recipes/tidy.json" }
```

- **Setup** runs before the take, fast and unrecorded, in the same window: it makes the demo data the take needs (or checks it is there).
- **Tidy** runs after the take, also unrecorded, and also after a take that stopped: it takes away what the setup and the take added, so the next take starts from the same place.
- Both are written like a capture script (the same steps, starting with `open`), without marks, layers, snapshots, `as` or `line`. They follow the same rules: no password or sign-in code fields, the brand's never-show list, the product's own site only.
- A script with no steps yet does nothing and says so. `--no-recipes` skips both for one run. `capture.json` lists what ran.
- Use the brand's cleared made-up names only, and remove only what the setup or the take added.

## Before every take

### A clean screen

The tool tidies the page before and during every take, in the recording too:

- **Hidden by the studio:** cookie and consent banners (the well-known ones, and any floating panel that talks about cookies), chat widgets (Intercom, Crisp, Tawk, Drift, HubSpot, Zendesk and a few more), scrollbars, the blink of the text cursor (it stays steady), spellcheck lines, and Chrome's address and card autofill.
- **Hidden, dismissed and kept by the brand:** the brand's `clean_screen` list in its `capture.json` (how to write it: `brands/_template/product/README.md`).
- **Set:** language, region, time zone, light or dark, and reduced motion, from the script or the brand.

It then checks it worked: anything it should have hidden but did not, or anything unlisted covering the page, stops the take.

### A frozen clock

The product's clock is set to the demo date and time (the script's, else the brand's) and runs on from there, so "2 minutes ago", calendars, due dates and "Good morning" read the same in every take. Timers in the product still work. `capture.json` says whether the clock was frozen and at what time. Times the product takes from its own server are not changed; for those, make demo data dated around the demo date. When a take resumes from a mark (`--from`), the clock picks up where the earlier take had it at that mark.

### Ready and settled

A take never starts on a half-loaded page. Before the first step, and whenever a page opens, the tool waits until fonts are loaded, the pictures on screen are drawn, the network has been quiet for half a second, and the picture has not changed for a quarter of a second. If that takes more than 20 seconds it stops and says why (for example "the network was still busy"). After every other step it waits the same way for up to 4 seconds; if the page is still moving it carries on and writes a warning. "Ready" also means no loading placeholders are on screen: grey skeleton cards, shimmer, spinners, an area marked busy, or three or more plain grey bars with nothing in them (the lines of a card still loading), and the picture has been still for a quarter of a second since they went. If a product shows one that never goes away, add it to `keep` in its `clean_screen` and it is no longer waited for.

While the page may be changing, the tool keeps Chrome's picture feed current: Chrome sometimes stops sending pictures after a change until something else forces one, so the tool changes one invisible pixel every frame (far too little to alter the picture) for a second after anything moves, loads or is typed. Pictures that come out identical are not kept, so the files stay small. Real waits over 0.6 seconds are marked in `cursor.json` so the engine can play them faster with a "Sped up" label.

### Privacy

At every mark, the words on screen are scanned for e-mail addresses, phone numbers and people's names (a common first name followed by a surname) that are not on the brand's safe list. Each one is blurred in the mark's still and its words file, and listed in the take's `warnings.txt` for a person to read before the footage is used. The recording itself is not blurred by the scan: mask the thing (`mask` step) or use made-up data, then record again. A never-show match stops the take instead.

## Takes

```
node tools/capture/capture.mjs rehearse jobs/<job> <name>   watch it in a window at half speed, nothing recorded
node tools/capture/capture.mjs dry jobs/<job> <name>        fast, nothing recorded: checks every step finds its target
node tools/capture/capture.mjs run jobs/<job> <name>        records the next take
node tools/capture/capture.mjs takes jobs/<job> <name>      lists the takes and the best one
node tools/capture/capture.mjs best jobs/<job> <name> 2     makes take 2 the best take
```

- **Rehearse** opens a Chrome window you can watch (in your own Chrome: the tool's own tab), at half speed. Keep your own mouse off it.
- **Dry run** also scans for private words at each mark and lists what a take would flag.
- **Run** records. In your own Chrome it records the tool's own tab, in front of you: keep your mouse off it. In the studio's own window (`--browser studio`) the window is shown while it records, because out of sight Chrome sends most pictures at normal sharpness and zooms would look soft: keep your mouse off it until the tool says it is done. `check` uses a shown window too, so it compares like with like. `--hidden` records out of sight instead, for a quick take nobody will zoom into (then check it with `--hidden` as well) (`capture.json` says how many pictures came at full sharpness). Each run makes the next numbered take (`take-1`, `take-2` ...), kept side by side. The newest take is the best take, until a person picks one with `best`; after that new takes do not replace the person's choice. The engine plays the best take.
- **Resume from a mark:** `run ... --from lead-added` replays the steps before that mark fast and unrecorded, so the page is in the same state, then records from the mark on. Steps that add something to the demo account add it again.
- **When a run stops** (any of the three), the tool saves a failure screen in `jobs/<job>/capture/<name>/failure/`: `still.png` (private words blurred; a never-show page is not saved), `words.txt` (the words on screen) and `report.txt` (which step, what it looked for, what it found instead, and the command to resume from the last mark before it).

Each take writes `jobs/<job>/capture/<name>/take-<n>/`:

| File | What |
|---|---|
| `recording.mp4` | The product at twice the page's size (3840 x 2160 for a desktop page, 780 x 1688 for a phone, a popup's own size for an extension), a steady 60 frames a second. No pointer is drawn in it. Large files: never synced, like renders. |
| `cursor.json` | Where the pointer was, moment by moment, and every click, key, shortcut, paste, drag path, scroll, wait, tab switch, size and theme change and mark, on the recording's clock. |
| `tracks.json` | One row per frame of the recording: `t` (seconds), `scroll` (the page scroll in that frame), `page` (the page size), and `at`, where each tracked thing was as `[x, y, width, height]` in page pixels (or `null` when it was not on the page). `things` says how each was found. The engine uses it for zooms and highlights that stay on the real thing. |
| `marks/<mark>.png`, `marks/<mark>.txt`, `marks/<mark>.layout.json` | A full-sharpness still of each named moment, the words on screen then, and where the named and tracked things sat (role, name and box in page pixels; private words left out). |
| `parts/` | The take's layers and snapshots (see "Layers and snapshots"). |
| `recording-<user>.mp4`, `cursor-<user>.json`, `tracks-<user>.json`, `events.json` | Two-user takes only: the second user's window, and every event of both on one clock (see "Two demo users"). |
| `capture.json` | When it was recorded, the product address, the brand, the kind of product and where the pictures came from (`source`: a web page, a WordPress demo site and what it was built from, a desktop app, a phone and its platform, or a terminal), the take number (and the mark it resumed from), the language, time zone, theme and clock used, what the clean screen hid and dismissed, every step as it ran and its time, each mark's page and tracked things, privacy flags and warnings, and the frame size; for these kinds of take also the AI answers (recorded or replayed, and when they were made), the extension page, touch, the demo users, layers, snapshots and what the setup and tidy scripts did. |
| `warnings.txt` | Only when there is something for a person to read: private words found, a system-drawn list, a pop-up that came up mid-take, a page that never settled. |

`best.json` next to the takes names the best take. The best take's recording, cursor and tracks are also put in `engine/public/jobs/<job>/capture/<name>/` for the engine.

### See it with its pointer

```
cd engine && npm run dev
```

Open `CapturePreview` in Remotion Studio. It plays the best take of the newest capture with the brand's pointer and click rings drawn on top. Type another capture's name (as the run printed it) in the props panel, pick the seconds to play with `from` and `to`, or switch on `zoom` to see a push in on the first click.

In a film, a scene uses `<CaptureClip>` from the engine's kit: which recording, which seconds of it, where it sits in the frame, and an optional zoom on part of the screen.

## Check it is still current

Products change every week. Before a film is delivered, run:

```
node tools/capture/capture.mjs check jobs/<job> <name>
```

`check` uses the studio's own window, so it can run while you are away and every check starts from the same clean Chrome. Add `--browser mine` to check in your own Chrome instead.

It does the same steps again without recording and compares each mark with the best take's three ways:

- **Picture:** the marked still, with how much of it changed and where. For each changed moment it writes `jobs/<job>/capture/<name>/check/<mark>.png`: the saved still on the left and today's on the right, with the changed area boxed.
- **Words:** the words on screen, as a set of labels (labels on one row may come out in any order, so order does not count). It names labels added and removed, and pairs a removed label with an added one that looks like it as a rename: `"New lead" became "Add lead"`.
- **Layout:** where the named things (buttons, links, tabs, fields, headings) and the tracked things sit (`marks/<mark>.layout.json`, saved with every mark). Anything that moved or changed size by more than 3 page pixels is named with how far (`the button "Export" moved 40 px down`); things that moved together are one line; a thing with a new name in the same place is a rename.

If anything changed, it ends with an error and writes `check/report.json`, so nothing gets delivered by accident. Record again if the change matters. Takes recorded before 12 Nov 2026 (evening) have no saved layout: their tracked things are still compared from `capture.json`, the named things only after the next take.

To compare two saved takes the same way, without opening Chrome: `node tools/capture/capture.mjs compare jobs/<job> <name> 4 5` (take 4 as saved, take 5 as today).

Steps that add something to the demo account (a new row, a new board) add it again on every run and check. A brand's tidy script takes them away after each run (see "Demo data: setup and tidy"); without one, delete those extras in the demo account between runs, or the check will rightly see two rows where there was one.

## Recording by hand with Cap

For a flow that is easier to do by hand, a native Mac app (not Electron), or a phone app on a Mac without the simulators, record it yourself with Cap (cap.so, free and open source; install it yourself, the studio does not include it).

- In Cap, turn off its own zoom effects and its cursor effects, and record the browser window only.
- Drop the file into `jobs/<job>/footage/`. The studio treats it as footage, like any other clip you bring.
- There is no `cursor.json` for a hand recording, so the film shows your real pointer, as recorded.
