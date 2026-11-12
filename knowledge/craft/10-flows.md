# Flows: showing how the product is used

A flow is a task carried from start to finish. Most Tulvo videos are one or more flows. Read at the idea and storyboard stages.

## Flow patterns

| Pattern | Shape | Suits | Example |
|---|---|---|---|
| Describe → built | One sentence in, a working system out | Promos, AI features | "Describe your business" → boards, pages and a site appear |
| Capture → track → act | Something comes in, it is organised, someone acts on it | Demos of forms, leads, pipelines | Form submitted → lead card appears → status changed → follow-up set |
| One record, many views | The same data shown as board, table, chart, page | Demos of data and views | A deal as a card, a row, a bar in a chart |
| Ask → answer in place | A question to the AI, the product changes | AI features, connected assistants | "Add a summary at the top" → the page updates |
| Trigger → outcome | An event elsewhere causes a visible change here | Automation, webhooks, integrations | Payment received → invoice marked paid → dashboard number rises |
| Before → after | The old way, then the Tulvo way, same task | Promos, comparisons | Twelve apps and logins → one workspace |
| Build → publish → live | Make something, publish it, see it working | Websites, forms, public pages | Edit a page → publish → open the live address |
| Team hand-off | The work passes between people | Collaboration | Assign → notify → comment → done |
| Zoom out | From one detail to the whole connected system | Endings, "everything talks to each other" | One card → the board → the workspace → the hub |

## Mapping a flow before storyboarding

Write the flow as a table in `jobs/<job>/flow.md`. One row per step the user takes.

| # | The user wants | They do | The product responds | Proof on screen | Screen (capture file) |
|---|---|---|---|---|---|

Then mark each row: **show** (on screen at real or near-real speed), **shorten** (shown sped up or skipped with a clean join), or **cut** (not needed for understanding). A flow of twelve steps is usually four shown, four shortened and four cut.

## Rules for flows

- Walk the flow in the demo workspace first. Every "show" row has a real capture.
- One customer, one set of data, from first step to last. Names, numbers and dates stay consistent across screens.
- The data tells a small story: a lead with a name becomes a deal with a value becomes an invoice that gets paid.
- Start on the outcome when you can: show the finished thing for three seconds, then how it was made.
- Each shown step follows ask, wait, result, proof (`05-ui-choreography.md`).
- Never skip a step in a way that hides effort the user will actually have to spend. Shorten it honestly and label real waits.
- A flow crosses screens by a hand-off object or the cursor, never by a cut to an unrelated view.
- End the flow on its outcome held as proof, not on the last click.

## Showing more than one flow

- Two or three flows in one film share a hub: return to the same home view between them, each time a little richer.
- Give each flow its own transition meaning (see `03-transitions.md`) and keep it.
- Each flow's payoff is bigger than the last.

## Making data believable

- Realistic names, companies, amounts and dates for the customer story. Varied, not repeated; no "Test 1", no codes.
- Numbers add up: totals match rows, percentages match counts.
- Dates sit around "today" in the story, in a sensible order.
- Status spread looks like real work: most things in progress, a few done, one or two late.
- Build this data in the demo workspace through the Tulvo connector, so captures and any rebuilt UI agree.

## The flow library

Every flow walked for a video is saved in `brands/<brand>/product/flows/<name>.md` with its step table, capture files, the date walked, and anything surprising. Before walking a flow, check whether it is already there and only re-walk if the product has changed since.

## References for flows

For how the best products present a flow on screen (onboarding, empty states, sharing), look at real examples before designing a staging. The reference library has creator walkthroughs in `cursor/` and continuous product flows in `claude/`.
