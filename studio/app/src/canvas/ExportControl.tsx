import { useState } from 'react';
import { plainMessage } from '../api';
import type { ExportRecord } from '../api';
import type { ExportRequest } from '../contracts/review';
import { Button, Select } from '../ui';

const shapes: { value: ExportRequest['ratio']; label: string }[] = [
  { value: '16:9', label: 'Wide (16:9)' },
  { value: '9:16', label: 'Tall (9:16)' },
  { value: '1:1', label: 'Square (1:1)' },
];
const heights = [720, 1080, 2160].map((h) => ({ value: String(h), label: `${h} high` }));
const qualities: { value: ExportRequest['quality']; label: string }[] = [
  { value: 'preview', label: 'Quick preview' },
  { value: 'master', label: 'Full quality' },
];

const describe = (x: ExportRecord) => `export ${x.export} (${x.ratio}, ${x.height} high)`;

export interface ExportControlProps {
  /** Every export asked for, oldest first. The last one is shown. */
  exports: ExportRecord[];
  /** Asks for an export. A refusal comes back as an error, shown in plain words. */
  onRequest(request: ExportRequest): Promise<void>;
  /** The address to download a finished export from. */
  urlFor(file: string): string;
}

/** Ask for a file in another shape or size, and see whether it is waiting, being made, ready (a link) or has failed (why). */
export function ExportControl({ exports, onRequest, urlFor }: ExportControlProps) {
  const [ratio, setRatio] = useState<ExportRequest['ratio']>('16:9');
  const [height, setHeight] = useState('1080');
  const [quality, setQuality] = useState<ExportRequest['quality']>('master');
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const last = exports[exports.length - 1];

  const ask = async () => {
    setBusy(true); setRefused(null);
    try { await onRequest({ ratio, height: Number(height) as ExportRequest['height'], quality }); } catch (e) { setRefused(plainMessage(e)); } finally { setBusy(false); }
  };

  return (
    <div className="canvas-export" role="group" aria-label="Export">
      <Select label="Export shape" hideLabel value={ratio} onChange={setRatio} options={shapes} />
      <Select label="Export height" hideLabel value={height} onChange={setHeight} options={heights} />
      <Select label="Export quality" hideLabel value={quality} onChange={setQuality} options={qualities} />
      <Button variant="default" disabled={busy} onClick={() => void ask()}>Export</Button>
      <span className="canvas-export-status" role="status">
        {refused ? <span className="canvas-export-failed">{refused}</span>
          : last?.status === 'requested' ? `Waiting to make ${describe(last)}.`
          : last?.status === 'running' ? `Making ${describe(last)}.`
          : last?.status === 'done' && last.file ? <>Ready: <a href={urlFor(last.file)} download>{last.file}</a></>
          : last?.status === 'failed' ? <span className="canvas-export-failed">{`Could not make ${describe(last)}: ${last.error ?? 'it did not finish.'}`}</span>
          : null}
      </span>
    </div>
  );
}
