// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api';
import type { ExportRecord } from '../api';
import { ExportControl } from './ExportControl';

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
