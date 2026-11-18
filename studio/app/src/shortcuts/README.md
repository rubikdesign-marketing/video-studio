Owned by Worker 4: state, history, server and shortcuts (ARCHITECTURE_PLAN.md section 6). Other workers do not change files here.

One table of shortcuts feeds the key handling, the sheet on `?` and the command menu on Cmd+K.

- The shell calls `useShortcuts()` once, calls `registerCoreShortcuts(history)` once, and renders `<ShortcutSheet />` and `<CommandMenu />`.
- Each worker hands in what its keys do: `registerPlaybackShortcuts({ playPause, ... })`, `registerPanelShortcuts({ ... })`, `registerNoteShortcuts({ ... })`. The keys and wording live in `table.ts`, so they stay in one place. Each call returns the function that takes the shortcuts out again (use it as an effect's clean-up).
- Anything else goes through `registerShortcuts([...])`.
- Styles use the role variables from `theme/tokens.css` only. No colour is written here.
