# Demo brand: a test brand

"Demo brand" is invented. It is here only to prove that the studio can switch from one brand to another without anyone touching engine code. Do not make a real video with it.

It differs from Tulvo on purpose:

- Colours: a deep green accent on an off-white page, and a dark green night page.
- Typeface: Inter for headlines and labels, from the npm package already installed in `engine/`.
- No accent typeface. A *starred* word in a headline is set in Inter at a heavier weight instead.
- No product, so no product colours and no product typeface.
- Squarer buttons.
- A simple wordmark drawn as lines in `logo/`.

See it:

```
node tools/brand/sync.mjs
node tools/brand/check.mjs demo
cd engine && npx remotion still BrandSheet out/brand-sheet-demo.png --props='{"brand":"demo"}'
```
