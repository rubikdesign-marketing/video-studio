// A page for looking at the timeline on its own, with the sample film and no server. Not part of the built app.
//   npm run dev, then open /editor/src/timeline/demo.html
// Add ?video=/editor/some-file.mp4 to play a real file (put it in studio/app/ while you look; do not commit it).
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '../theme/tokens.css';
import '../theme/base.css';
import { sampleFilm } from '../fixtures/sample-film';
import { registerPlaybackShortcuts, usePlayback } from '../playback';
import { Shell } from '../shell';
import { CommandMenu, registerCoreShortcuts, ShortcutSheet, useShortcuts } from '../shortcuts';
import { editor, history, useSelection } from '../store';
import { startTheme, ThemeSwitch } from '../theme';
import { Toasts } from '../ui';
import { Timeline } from './index';
import { useTimelineView } from './view';

editor.stores.film.setState({ job: 'timeline-demo', status: 'ready', film: sampleFilm, filmModified: 1 });
editor.stores.edits.setState({ edits: [], filmModified: 1 });
editor.stores.notes.setState({
  notes: [
    { localId: 'demo-1', time: 1.4, kind: 'keep', topic: null, must: false, text: 'Love this opening.', box: null },
    { localId: 'demo-2', time: 6.4, kind: 'change', topic: 'text', must: true, text: 'Make the words bigger.', box: null },
    { localId: 'demo-3', time: 10.1, kind: 'change', topic: null, must: false, text: 'A beat longer here.', box: null },
  ],
});

// There is no job behind this page, so saving has nowhere to go: answer it here instead of the server.
const realFetch = window.fetch.bind(window);
window.fetch = (input, init) => (String(input).includes('/api/') ? Promise.resolve(new Response('{"ok":true}')) : realFetch(input, init));

// For checking by hand in the browser console.
Object.assign(window, { demo: { editor, usePlayback, useTimelineView } });

const source = new URLSearchParams(location.search).get('video');

function Demo() {
  useShortcuts();
  useEffect(() => { const stops = [registerCoreShortcuts(history), registerPlaybackShortcuts()]; return () => stops.forEach((stop) => stop()); }, []);
  const selection = useSelection();
  return (
    <>
      <Shell
        topBar={<><strong>Timeline, on its own</strong><span style={{ flex: 1 }} /><ThemeSwitch /></>}
        left={<p style={{ padding: 16 }}>Selected: {selection ? JSON.stringify(selection) : 'nothing'}</p>}
        canvas={source
          ? <video ref={(el) => usePlayback.getState().attachVideo(el)} src={source} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <p style={{ padding: 16 }}>No video on this page. Add ?video= and a file address to play one.</p>}
        right={<p style={{ padding: 16 }}>Press ? for the shortcuts.</p>}
        timeline={<Timeline />}
      />
      <ShortcutSheet />
      <CommandMenu />
      <Toasts />
    </>
  );
}

startTheme();
const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><Demo /></StrictMode>);
