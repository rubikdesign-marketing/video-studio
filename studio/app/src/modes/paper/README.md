Owned by Worker 4: state, history, server and shortcuts (ARCHITECTURE_PLAN.md section 6). Other workers do not change files here.

Paper edit mode: the old transcript page (`studio/paper.html`, still served at `/paper`) inside the editor, at
`/editor/?job=<job>&mode=paper`. It reads and writes the same files through the same addresses (`/api/paper`,
`/api/paper/save`, `/api/paper/send`, `/clip-media/`), so the two pages can be used on the same job.

- `store.ts`: the paper edit's state. Every change to the sentences, pauses and joins is a step in the shared history
  with a plain label, and saves by itself a moment later.
- `player.ts`: plays one word, or the whole edit run by run, on one video element.
- `PaperMode.tsx`: the page, laid out in the shell's slots. `paper.css`: its styles, theme roles only.
- `words.ts`: small pure helpers (labels, times, what a sentence reads like).
