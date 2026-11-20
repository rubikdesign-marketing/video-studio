// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api';
import type { ExportRecord } from '../api';
import { ExportControl, shapeOf } from './ExportControl';

afterEach(cleanup);
const record = (x: Partial<ExportRecord>): ExportRecord => ({ export: 3, ratio: '9:16', height: 1080, quality: 'master', status: 'requested', ...x });
const show = (exports: ExportRecord[], onRequest = vi.fn(async () => {})) => {
  render(<ExportControl exports={exports} onRequest={onRequest} urlFor={(f) => `/media/j/${f}`} />);
  return onRequest;
};

describe('the Export control', () => {
  it('asks for the chosen shape once per press', async () => {
    const onRequest = show([]);
    fireEvent.change(screen.getByLabelText('Export shape'), { target: { value: '9:16' } });
    fireEvent.change(screen.getByLabelText('Export height'), { target: { value: '720' } });
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(onRequest).toHaveBeenCalledTimes(1));
    expect(onRequest).toHaveBeenCalledWith({ ratio: '9:16', height: 720, quality: 'master' });
  });
  it('says waiting, making, ready (with a link) and failed (with why)', () => {
    cleanup(); show([record({ status: 'requested' })]);
    expect(screen.getByRole('status').textContent).toBe('Waiting to make export 3 (9:16, 1080 high).');
    cleanup(); show([record({ status: 'running' })]);
    expect(screen.getByRole('status').textContent).toBe('Making export 3 (9:16, 1080 high).');
    cleanup(); show([record({ status: 'done', file: 'export-003-9x16-1080.mp4' })]);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/media/j/export-003-9x16-1080.mp4');
    cleanup(); show([record({ status: 'failed', error: 'The render did not finish, so nothing was exported.' })]);
    expect(screen.getByRole('status').textContent).toContain('The render did not finish, so nothing was exported.');
  });
  it('shows a refused request in plain words', async () => {
    show([], vi.fn(async () => { throw new ApiError('refused', 'An export needs a shape.', { status: 400 }); }));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('An export needs a shape.'));
  });
});

describe('what the Export control says about the film it was cut from', () => {
  it('shows the how-to-fix line under a failed export', () => {
    show([record({ status: 'failed', error: 'Exporting needs a full ffmpeg, which was not found on this computer, so nothing was exported. Add it, then export again.', detail: 'To add it: brew install ffmpeg-full' })]);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Exporting needs a full ffmpeg');
    expect(screen.getByText('To add it: brew install ffmpeg-full')).toBeTruthy();
  });
  it('says the text changes not in the film are not in the export', () => {
    show([record({ status: 'running', edits_pending: 2 })]);
    expect(screen.getByRole('status').textContent).toContain('Your 2 text changes are not in the film yet, so this export does not include them.');
    cleanup(); show([record({ status: 'done', file: 'export-003-9x16-1080.mp4', edits_pending: 1 })]);
    expect(screen.getByRole('status').textContent).toContain('Your 1 text change is not in the film yet, so this export does not include it.');
  });
  it('says which film a finished export was cut from', () => {
    const at = '2026-11-20T09:30:00.000Z';
    show([record({ status: 'done', file: 'export-003-9x16-1080.mp4', source: 'out/demo.mp4', source_rendered_at: at })]);
    expect(screen.getByRole('status').textContent).toContain(`from the film rendered ${new Date(at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`);
  });
  it("starts on the film's own shape until another is picked", async () => {
    const onRequest = vi.fn(async () => {});
    render(<ExportControl exports={[]} onRequest={onRequest} urlFor={(f) => f} filmShape="9:16" />);
    expect((screen.getByLabelText('Export shape') as HTMLSelectElement).value).toBe('9:16');
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(onRequest).toHaveBeenCalledWith({ ratio: '9:16', height: 1080, quality: 'master' }));
  });
  it('maps a film to its shape: tall, square, otherwise wide', () => {
    expect(shapeOf({ width: 1080, height: 1920 })).toBe('9:16');
    expect(shapeOf({ width: 1080, height: 1080 })).toBe('1:1');
    expect(shapeOf({ width: 1920, height: 1080 })).toBe('16:9');
    expect(shapeOf({ width: 1080, height: 1350 })).toBe('16:9');
    expect(shapeOf(null)).toBe('16:9');
  });
});
