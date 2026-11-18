Owned by Worker 1: design system and shell (ARCHITECTURE_PLAN.md section 6). Other workers do not change files here.

`Shell` lays out the workspace. Fill it through its props: `topBar`, `left`, `canvas`, `right`, `timeline`.

Panels: `usePanels()` in a component, or `usePanelsStore.getState()` anywhere else, gives `toggle('left' | 'right' | 'timeline')`, `isOpen(name)` and `resize(name, pixels)`. Sizes and collapsed panels are remembered per browser. Under 1080px wide the side panels open as drawers and are not remembered.
