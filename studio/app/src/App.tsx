import { useState, type ReactNode } from 'react';
import { Shell } from './shell';
import { ThemeSwitch } from './theme';
import { Button, Chip, Field, Segmented, Select, Sheet, Toasts, Tooltip, showToast } from './ui';
import './App.css';

/** A labelled stand-in for a part another worker will build. */
function Placeholder({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="placeholder">
      <h2 className="placeholder-title">{title}</h2>
      <p>{children}</p>
    </div>
  );
}

type Ratio = 'wide' | 'tall' | 'square';

/** The base controls in one place, so both themes can be judged before the real panels land. */
function ControlsPreview() {
  const [ratio, setRatio] = useState<Ratio>('wide');
  const [quality, setQuality] = useState<'preview' | 'master'>('preview');
  const [must, setMust] = useState(true);
  const [words, setWords] = useState('A sample film.');
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);
  return (
    <div className="preview">
      <h3 className="preview-title">Controls</h3>
      <div className="preview-row">
        <Button variant="primary" onClick={() => showToast('Notes sent.', { tone: 'good' })}>
          Send notes
        </Button>
        <Button onClick={() => setOpen(true)}>Shortcuts</Button>
        <Tooltip label="Nothing is undone yet">
          <Button variant="quiet">Undo</Button>
        </Tooltip>
      </div>
      <div className="preview-row">
        <Chip selected={must} onClick={() => setMust(!must)}>
          Must fix
        </Chip>
        <Chip>Scene 2</Chip>
        <Chip>
          <span className="time">0:03.50</span>
        </Chip>
      </div>
      <Segmented
        label="Frame shape"
        value={ratio}
        onChange={setRatio}
        options={[
          { value: 'wide', label: 'Wide' },
          { value: 'tall', label: 'Tall' },
          { value: 'square', label: 'Square' },
        ]}
      />
      <Select
        label="Quality"
        value={quality}
        onChange={setQuality}
        options={[
          { value: 'preview', label: 'Preview' },
          { value: 'master', label: 'Master' },
        ]}
      />
      <Field label="On-screen text" value={words} onChange={setWords} hint="Seven words at most." />
      <Field label="Note" multiline value={note} onChange={setNote} placeholder="What should change here?" />
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Shortcuts"
        footer={
          <Button variant="primary" onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      >
        <p>The list of shortcuts will appear here.</p>
      </Sheet>
    </div>
  );
}

/** The workspace with stand-in content in every slot, until the other workers fill them. */
export function App() {
  return (
    <>
      <Shell
        topBar={
          <>
            <h1 className="app-title">Video Studio</h1>
            <span className="app-film">Sample film, version 1</span>
            <span className="app-spacer" />
            <ThemeSwitch />
          </>
        }
        left={<Placeholder title="Left panel">Scenes, notes and versions will appear here.</Placeholder>}
        canvas={<Placeholder title="Canvas">The film plays here.</Placeholder>}
        right={
          <>
            <Placeholder title="Right panel">Details and the note editor will appear here.</Placeholder>
            <ControlsPreview />
          </>
        }
        timeline={
          <Placeholder title="Timeline">Scenes, voice, on-screen text, notes and energy will appear here.</Placeholder>
        }
      />
      <Toasts />
    </>
  );
}
