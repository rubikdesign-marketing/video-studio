# Frame quality

Every frame at rest should stand as a designed image. Read by the storyboarder and scene builders; checked by the inspector.

Sizes are a share of frame height (H) or width (W).

## The grid

- **Safe area:** nothing that matters within 5% of any edge. Captions live in the bottom band between 82% and 93% of H.
- **Columns:** a 12-column grid with margins of 5% W. Subjects align to column edges.
- **Spacing scale:** 0.75%, 1.5%, 3%, 6% and 12% of H. No other gaps. Related things sit 1.5% apart, groups 3–6%.
- **Alignment:** everything in a frame shares at most three vertical alignment lines. A headline and the window under it start on the same line.

## Composition

- **One focal point.** Decide it; make it the largest, sharpest or most colourful thing; let everything else support it.
- **Hierarchy in three levels:** the thing, its support, the stage. A fourth level is clutter.
- **Breathing room:** the focal subject fills 55–75% of W for product, or sits with at least 12% H of space around hero type.
- **Balance:** a subject off-centre needs a counterweight (a caption, a shadow, a second smaller element) or deliberate empty space on the side it faces.
- **Nothing kisses an edge.** Elements are either clearly inside the frame or clearly cropped by at least a quarter of their size.
- **No tangents:** edges of separate elements do not touch or nearly touch. Overlap clearly or separate clearly.

## Product UI in frame

- Captures at double resolution; never scaled above 100% of their real pixels at rest.
- Text inside UI at least 2.6% H when it must be read. If it is smaller, push in or crop tighter.
- Pixel edges at rest: a still UI sits on whole pixels so thin lines stay crisp. Sub-pixel positions are for things in motion.
- Crop on a component boundary (a card, a column, a panel), never through the middle of a row or a word.
- Empty or irrelevant parts of a screen are cropped out, not shown.
- The same screen in two shots has the same data.

## Type in frame

- Hero and headline lines break by meaning, not by width. No single word left on its own line.
- Left-aligned or centred; never both in one frame.
- Line length for anything read: 12–28 characters for hero lines, up to 42 for captions.
- Contrast: text against what is behind it at 4.5 to 1 or better, measured on the real frame.

## Colour in frame

- At most one accent and one warm note, plus the product's own colours.
- Hues the brand rejects appear only inside product UI.
- No large areas of pure black or pure white: lift blacks slightly on light films, keep whites just under full on dark films, so grain and gradients have room.

## Sharpness and rendering

- Masters are rendered at full size; previews are smaller but from the same scenes.
- Thin lines are at least 1 px at 1080p after any scaling.
- Rounded corners use the same radius family across a frame.
- Shadows have no hard edge and no banding. Gradients are rendered with grain over them to prevent banding.
- No compression blocks in captures: use PNG captures, never screenshots of screenshots.

## Frames in motion

- Check the frames a move starts and ends on. They are the ones people see longest.
- Half-way frames of a transition should not contain readable text in mid-stretch or a half-visible logo.
- The first frame and the last frame of the film work as poster images.

## The frame audit

At the storyboard: every key frame is checked against this file before it goes on the design canvas.

On a rendered cut, `tools/checks/frame_quality.py` measures each rest frame:

| Measure | Flags |
|---|---|
| Edge crowding | Detail inside the outer 4% of the frame |
| Focal points | More than two separate areas of strong detail, or none |
| Clutter | Too much of the frame carrying detail |
| Off-brand colour | A colour the brand has rejected (`rejected` `colours` in its `brand.json`) covering more than a small share; greys only when they fill a large part of the frame. Pass `--brand`, else the studio's default brand is used. A rejected colour the check has no range for is printed as "not checked": look for it by eye |
| Brightness | Large areas of pure black or pure white |

A flag means look at that frame, not fail it: product UI legitimately contains coloured chips and dense tables. The inspector decides, and says which flags were cleared and why.

## Raising the bar on a frame

When a frame looks ordinary, try in this order:

1. Crop tighter. Most frames show too much.
2. Remove one element.
3. Increase the size difference between the focal point and everything else.
4. Give it light: one shadow, one highlight, a direction.
5. Give it depth: something soft in front or behind.
6. Only then add anything.
