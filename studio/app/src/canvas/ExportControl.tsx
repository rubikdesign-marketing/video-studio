import { useState } from 'react';
import { plainMessage } from '../api';
import type { ExportRecord } from '../api';
import type { ExportRequest } from '../contracts/review';
import { Button, Select } from '../ui';
import { isTall } from './geometry';

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
const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
/** The editor's text changes are saved beside the film; an export is cut from the film as it was rendered, without them. */
const pendingLine = (n: number) => (n === 1
  ? 'Your 1 text change is not in the film yet, so this export does not include it.'
  : `Your ${n} text changes are not in the film yet, so this export does not include them.`);

/** The shape a film already has: a tall film exports tall by default, a square one square, anything else wide. */
export function shapeOf(film: { width: number; height: number } | null | undefined): ExportRequest['ratio'] {
  if (!film || !film.width || !film.height) return '16:9';
  if (isTall({ w: film.width, h: film.height })) return '9:16';
  if (film.width === film.height) return '1:1';
  return '16:9';
}

export interface ExportControlProps {
  /** Every export asked for, oldest first. The last one is shown. */
  exports: ExportRecord[];
  /** Asks for an export. A refusal comes back as an error, shown in plain words. */
  onRequest(request: ExportRequest): Promise<void>;
  /** The address to download a finished export from. */
  urlFor(file: string): string;
  /** The film's own shape, the shape chosen until another is picked. */
  filmShape?: ExportRequest['ratio'];
}

/** Ask for a file in another shape or size, and see whether it is waiting, being made, ready (a link) or has failed (why). */
export function ExportControl({ exports, onRequest, urlFor, filmShape = '16:9' }: ExportControlProps) {
  const [picked, setRatio] = useState<ExportRequest['ratio'] | null>(null);
  const ratio = picked ?? filmShape;                    // follows the film (it may load after this) until a shape is picked
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
          : last?.status === 'done' && last.file ? <>Ready: <a href={urlFor(last.file)} download>{last.file}</a>{last.source_rendered_at ? `, from the film rendered ${when(last.source_rendered_at)}.` : null}</>
          : last?.status === 'failed' ? <span className="canvas-export-failed">{`Could not make ${describe(last)}: ${last.error ?? 'it did not finish.'}`}</span>
          : null}
        {!refused && last?.status === 'failed' && last.detail ? <span className="canvas-export-detail">{last.detail}</span> : null}
        {!refused && last && last.status !== 'failed' && last.edits_pending ? <span className="canvas-export-detail">{pendingLine(last.edits_pending)}</span> : null}
      </span>
    </div>
  );
}
