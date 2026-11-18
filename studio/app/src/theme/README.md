Owned by Worker 1: design system and shell (ARCHITECTURE_PLAN.md section 6). Other workers do not change files here.

`tokens.css` is the only file under `src/` that may hold a literal colour. Components use the role tokens (`--surface-*`, `--text-*`, `--line`, `--accent`, `--on-accent`, `--good`, `--warn`). `contrast.test.ts` lists which text role may sit on which surface. `--good` and `--warn` are for marks and borders, not for words.
