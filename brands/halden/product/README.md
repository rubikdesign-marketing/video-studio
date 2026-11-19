# Product knowledge

What the studio has learned about the brand's product by using it. Every entry is dated and has a screenshot or a capture file.

- `flows/` holds one file per walked flow: its step table, capture files, the date walked, and anything surprising.
- Add a dated note here whenever a screen, a label or a behaviour is found to have changed.

Delete this folder's contents if the brand has no product.

## Where the product lives

Filled in at stage 0, so screens can be captured fresh for each video. Products change every week, so the studio never keeps a standing copy of the screens.

- **Web address of the product:** (for example app.example.com)
- **Demo account to film in:** its name, and who signs in to it in the browser pane. Never film a real customer's account.
- **Names that are safe to show:** made-up businesses and people used in the demo account, checked against real companies.
- **What must never be shown:** for example billing pages, real e-mails, beta features not yet announced.
- **A connector that can build pages or records in it, if there is one.**

## The capture file (`capture.json`)

The capture tool (`tools/capture/README.md`) reads `capture.json` in this folder to know where to record. Copy the empty one from `brands/_template/product/capture.json` and fill it in at stage 0.

| Key | What to write |
|---|---|
| `address` | The product's full web address, like `https://app.example.com`. Not needed for a WordPress demo site the studio builds, a desktop app, a phone app or a command-line tool. Steps such as `{"open": "/leads"}` are opened inside it, and the tool never leaves this site unless a step names a full address. |
| `demo_account` | The name of the demo account to film in. Shown to the person when they sign in. |
| `signs_in` | Who signs in, by hand, with `node tools/capture/capture.mjs signin <brand>`. |
| `safe_to_show` | Made-up businesses and people in the demo account, checked against real companies. |
| `never_show` | A list of things never to film. Each one is `{ "what": "plain words" }` plus any of: `"paths"` (the tool refuses to open, and stops on, any address containing one of these), `"text"` (it stops if these words are on screen), `"pattern"` (a text pattern, such as one for e-mail addresses) with `"allow"` (bits of text that make a match fine, like `"@example.com"`). A rule with only `"what"` is shown as a reminder at the start of each recording. |
| `browser` | Optional. Which Chrome records this brand's takes by default: `"mine"` (your own Chrome, through the Playwright Extension; the studio's default) or `"studio"` (the studio's own window, signed in with `signin`). `check` uses the studio's window unless told otherwise. See `tools/capture/README.md`, "Which Chrome records". |
| `chrome_profile` | Optional. When your own Chrome has several profiles: the one the Playwright Extension is installed in, by its folder name (the last part of "Profile Path" on `chrome://version`, like `"Profile 2"`). |
| `signin_paths` | Optional. Address beginnings that mean "this is a sign-in page". The default covers `/login`, `/signin`, `/sign-in`, `/auth` and `/sso`. A page with a password field always counts. |
| `clean_screen` | What to tidy away before and during every take (see below). |
| `setting` | How the page is shown: `language` (like `"en"`), `region` (like `"GB"`), `time_zone` (like `"Europe/London"`; empty means this Mac's), `theme` (`"light"` or `"dark"`) and `reduced_motion` (`false` keeps the product's own motion). A capture script can override each one. |
| `kind` | Optional. The kind of product, which fills sensible defaults for it: `"web app"`, `"ai product"`, `"wordpress"`, `"shop"`, `"extension"`, `"phone web"`, `"desktop"` (an Electron app), `"phone app"` or `"command line"`. What each one sets: `tools/capture/README.md`, "Product kinds", or `node tools/capture/capture.mjs kinds`. Anything written here yourself wins over the kind's defaults. |
| `size`, `touch` | Optional. The page size takes start at (`"desktop"`, `"laptop"`, `"tablet"`, `"phone"`, `"phone large"` or `[width, height]`), and `true` for touch (a phone's taps and swipes, no hover). The kind sets these; a script can too. |
| `ready_limit`, `settle_limit`, `stopped` | Optional. Seconds to wait for a page to be ready (20) and to settle after a step (4), and for an AI answer `{ "quiet": 1.5, "limit": 90 }` (how long its text must stay the same, and the longest it may take). |
| `ai` | Optional, for products that write answers with AI. `{ "answers": ["/api/chat"] }`: the product's own addresses whose answers are recorded once and replayed for retakes (never sign-in or token addresses, whatever is listed). `"replay": false` turns it off. The `ai product` kind starts from `["/api/"]`. |
| `extension` | Optional, for a Chrome extension. `{ "folder": "../extension/dist" }`: the unpacked extension's folder (the one with `manifest.json`), relative to this file. `"popup_size": [360, 480]` fixes the popup's size instead of measuring it; `"panel_size": [360, 900]` sets the side panel's. |
| `recipes` | Optional. `{ "setup": "recipes/setup.json", "tidy": "recipes/tidy.json" }`: capture scripts (the same steps, no marks) that make the demo data before every take and take it away after, so records a take adds do not pile up. |
| `email` | Optional, for e-mails the product sends: `{ "folder": "emails" }` (a folder of `.eml` files) or `{ "mailpit": "http://localhost:8025" }` (a local test inbox), and `"size": "800x1000"`. |
| `site` | Optional, for WordPress. With a WordPress Playground blueprint in `blueprint.json` next to this file, the studio builds a fresh demo site for every take and signs its demo users in itself (`"site": { "signin_as": "admin" }` picks who). `"site": "own"` films the `address` instead (a staging or local site), signed in by hand. See `tools/capture/README.md`, "WordPress demo sites". |
| `app` | For a desktop app built with Electron: `{ "path": "/Applications/Example.app" }`, or the app's source folder. See "Desktop apps" in `tools/capture/README.md`. |
| `phone` | For a phone app: `{ "platform": "ios" or "android", "app": "com.example.app", "install": "build/Example.app", "device": "iPhone 17 Pro" }`. See "Phone apps". |
| `terminal` | For a command-line tool: `columns`, `rows`, `theme`, `font_size`, `prompt`, `folder` (demo files copied fresh for each take) and `env`. See "Command-line tools". |
| `clock` | `demo_time`: the date and time the product's clock shows in a take, like `"2026-11-20 10:30"`, in the time zone above. It runs on from there, so "2 minutes ago" reads the same in every take. A script can set its own, or `"clock": false` for real time. Write `"clock": false` here to use real time for every video. `note`: anything a person should know, for example "the dashboard takes the date from the server, so demo data is dated around the demo date". |

`safe_to_show` also feeds the privacy scan: at every mark, e-mail addresses, phone numbers and people's names on screen that are not on this list (and not on a never-show e-mail rule's `allow` list) are blurred in the still and listed for a person. A piece of a name works too, like `"@kestrel.studio"` for every address at that made-up domain. With the e-mail rule above in `never_show`, a real-looking address stops the take instead.

### The clean screen

The studio already hides cookie and consent banners, the common chat widgets (Intercom, Crisp, Tawk, Drift, HubSpot, Zendesk), scrollbars, the caret's blink, spellcheck lines and Chrome's autofill. `"studio_defaults": false` turns that off for a product whose own chat or consent screen is what the video is about. Then list what this product needs:

| List | Each item | What happens |
|---|---|---|
| `hide` | `{ "what": "Feedback tab", "selector": "#feedback-tab" }` or `{ "what": "Update nag", "text": "A new version is available" }` | Hidden for the whole take, also when it comes back. Words hide the floating panel they sit in (a banner, a pop-up, a tab stuck to the edge); add `"anywhere": true` to hide words in the page itself. |
| `dismiss` | `{ "what": "What's new pop-up", "click": "Got it", "in": "What's new" }` or `{ "what": "Product tour", "press": "Escape", "when": "Take the tour" }` | Closed before the take starts and whenever it comes up, like a person would close it. `"wait": 1.5` gives it that long to appear after a page opens (1 second by default). One that comes up mid-take is in the recording, and the take's warnings say so. |
| `keep` | `{ "what": "Beta label", "text": "Beta" }` or a `selector` | Never hidden, even if a studio rule would hide it, and never counted as something covering the page. For things that are true and belong in the film: Beta labels, real limits, the empty state the video is about. |

After tidying, the tool checks: anything a rule should have hidden that is still showing, or anything not listed that covers the page when a page opens (a dialog, a big overlay, a widget from another site, a cookie banner), stops the take with a still of it, boxed in red.

The sign-in itself is kept in `.capture/<brand>/` on the Mac that signed in, and is never synced or shared. The tool never types, reads or stores a password or a sign-in code.
