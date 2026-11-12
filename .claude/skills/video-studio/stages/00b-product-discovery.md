# Stage 0B: product discovery

Done once per product, after the brand is set up (stage 0) and before its first video. Refreshed when the product, the pricing or the audience changes, and checked against the product's changelog at the start of every new video. Ends with the **Discovery** approval.

Why: a video is only as good as its understanding of who it is for and what they need to see. Research comes first, so the idea, the script and the flows are right before anything is designed.

Output: `brands/<brand>/product/discovery.md` (from `templates/discovery.md`), its sources in `brands/<brand>/product/discovery-sources/`, and the product's filming recipe in `brands/<brand>/product/capture.json`.

## Read first

- `templates/discovery.md` (what to fill in and the rules for sources)
- `brands/<brand>/brand.md` and anything already in `brands/<brand>/product/`
- `CAPTURE-PLAN.md`, section 2 (what is special about each kind of product) and section 4 (demo environments and filming recipes)

## 1. Research, before asking anyone anything

Use the cheapest source that answers. Save each page or quote used in the sources folder with its date.

| Source | What it gives |
|---|---|
| The company's website, pricing page, docs, changelog, blog | What it claims, plans and prices, recent launches, the words it uses |
| Reviews: G2, Capterra, Trustpilot, app stores, the WordPress.org plugin page and support forum, the Chrome Web Store, Shopify's app store | Customers' own words, praise, complaints, who they are |
| Communities: Reddit, Facebook groups, X, LinkedIn, YouTube comments | Pains and alternatives in plain words |
| Competitors' sites and videos | How the category shows itself; gaps |
| The company's own existing videos and ads (and the Meta ad library) | What it has tried, what to keep or drop |
| Market reports the company already has (for Tulvo: the phase 2 positioning report) | Segments and positioning already agreed |

Then fill sections 1 to 4 and 7 of the template, marking each claim verified, company says, or guess.

What is special by kind of product:
- **WordPress plugins:** active installs, rating and the support forum on WordPress.org; free versus paid features; add-ons; which other plugins it needs (WooCommerce and so on); the roles it serves (admin, vendor, customer).
- **Web and AI products:** plans and limits; what the AI does and does not do; beta features; integrations.
- **Shop apps, extensions and phone apps:** store listings and their reviews; screenshots the store already shows.
- **Developer tools:** docs, GitHub issues and discussions; the commands people run first.

## 2. Walk the product

1. Sign in to the demo environment in the browser pane (or the person's Chrome), or build one from a recipe if the company has none (CAPTURE-PLAN.md, section 4.1). A person signs in by hand.
2. Walk every candidate flow from start to the moment the customer would say "that's it". Save a still at each step.
3. Note waits, AI answers, pop-ups, third-party screens, anything that changed from the docs, and anything that looks broken. Broken things are never filmed; tell the company.
4. Fill section 5 (features and ranked flows) and section 6 (the demo environment), and fill or update `capture.json`: address, demo account, roles, safe names, clean-screen list, never-show list.

## 3. Grill the company

Only on what research and the product could not answer (section 10 of the template). In rounds: numbered questions, each with a recommended answer, worded so "yes" accepts it. Typical gaps:
- Which segment matters most this quarter.
- Proof that may be shown (customer names, numbers).
- Claims that must not be made.
- Features not to show yet.
- Who owns the demo environment, and whether the studio may build its own.
- Where the videos will run and what has worked.

## 4. First video ideas

Fill section 9: five ideas, each tied to a segment, a flow, a stage of the buyer's journey and a channel. These feed stage 1.

## 5. Hand over

Give a one-page summary: who it is for, the three key messages, the top three flows, the demo environment, the five ideas, and what is still open. Say what was verified in the product and what was taken on trust. Stop for the **Discovery** approval.

## Keeping it fresh

- At the start of every video, read the changelog since the discovery date and walk the flow the video uses. Record changes in `brands/<brand>/product/` with the date.
- Redo the whole discovery when the pricing, the main audience or the positioning changes, or after six months.
