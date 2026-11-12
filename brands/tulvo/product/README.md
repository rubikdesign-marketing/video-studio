# Tulvo product knowledge

What the studio has learned about the product by using it. Every entry is dated and has a screenshot or a capture file.

- `flows/` holds one file per walked flow: its step table, capture files, the date walked, and anything surprising.
- Add a dated note here whenever a screen, a label or a behaviour is found to have changed.

Known so far (11 Nov 2026):
- The demo workspace is "Kestrel Studio". It has boards for Clients, Campaigns, Creative Briefs, Leads, Invoices and Revenue, and a project enquiry form.
- The Tulvo connector builds boards, pages and sites inside the connected workspace. It cannot create a workspace, delete anything, or return screenshots.
- Screens for a film are captured fresh for that film (owner, 11 Nov 2026): the product changes every week. The UI rebuild in `engine/src/products/tulvo/` was made from the live app on 20 Oct 2026 and is a pattern library only, never shown as the current product.
- 11 Nov 2026: the sidebar now opens a "Tulvo AI" chat panel (not in the 20 Oct capture). The "Client mix" chart on Kestrel's home page is not used in films for now.
- What the product could not honestly show during the Black Friday film: a Reports page, a live-updating dashboard. See that film's discovery notes before promising either.
- 11 Nov 2026: where the product lives and what never to film, for the capture tool, is in `capture.json` here (`tools/capture/README.md`). Not signed in for capture yet: `node tools/capture/capture.mjs signin tulvo`.
