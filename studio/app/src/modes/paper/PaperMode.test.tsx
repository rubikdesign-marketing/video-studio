// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import type { PaperData, PaperPayload } from '../../api';
import { useReviewer } from '../../notes';
import { handleKey, shortcutStore } from '../../shortcuts';
import { history } from '../../store';
import { flaggedJoin, samplePaper } from './fixture';
import { paper, player, PaperEdit } from './index';

/** A pretend studio server behind `fetch`: it answers the paper addresses and remembers what it was sent. */
let disk: PaperData; let jobs: { job: string; name: string; status: string }[];
let posts: { url: string; body: PaperPayload }[];
const settle = async (ms = 0) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };
const word = (text: string) => screen.getByRole('button', { name: text });
const sentence = (n: number) => screen.getByRole('article', { name: new RegExp(`^Sentence ${n} of`) });
const wordsOf = (n: number) => within(sentence(n)).getAllByRole('button').filter((b) => b.classList.contains('pp-word')).map((b) => `${b.textContent}${b.getAttribute('aria-pressed') === 'true' ? '✂' : ''}`).join(' ');

beforeEach(() => {
  disk = samplePaper(); jobs = [{ job: 'demo', name: 'Sample footage', status: 'draft' }, { job: 'second', name: 'Second film', status: 'sent' }]; posts = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/api/paper/jobs')) return new Response(JSON.stringify({ jobs }));
    if (url.includes('/api/paper/save') || url.includes('/api/paper/send')) {
      posts.push({ url, body: JSON.parse(String(init?.body)) as PaperPayload });
      return new Response(JSON.stringify({ ok: true, check: disk.check, status: url.includes('send') ? 'sent' : 'draft' }));
    }
    if (url.includes('/api/paper?')) return new Response(JSON.stringify(disk));
    return new Response(JSON.stringify({ jobs: [] }));
  }));
  for (const name of ['play', 'pause', 'load'] as const) vi.spyOn(HTMLMediaElement.prototype, name).mockImplementation((() => Promise.resolve()) as never);
  localStorage.clear();
  useReviewer.setState({ name: 'Sam' });
  window.history.replaceState(null, '', '/editor/?job=demo&mode=paper');
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); shortcutStore.setState({ shortcuts: [], sheetOpen: false, menuOpen: false }); });

async function open(ui = <PaperEdit modeSwitch={<span>switch</span>} />) {
  const view = render(ui);
  await settle(); await settle();
  return view;
}

describe('paper edit mode', () => {
  it('opens the job in the address and draws every sentence with its words, tags and tools', async () => {
    await open();
    expect(screen.getAllByRole('article')).toHaveLength(4);
    expect(wordsOf(1)).toBe('Um,✂ this is the first sentence.');
    expect(wordsOf(3)).toBe('We✂ make✂ videos✂ quickly.✂');
    expect(sentence(3).getAttribute('data-out')).toBe('true');
    expect(within(sentence(1)).getByText('take-1 · 0:00.5')).toBeTruthy();
    expect(within(sentence(3)).getByText('Take 1 of 2')).toBeTruthy();
    expect(within(sentence(4)).getByText('Take 2 of 2, the one proposed')).toBeTruthy();
    expect(within(sentence(4)).getByText('opening idea')).toBeTruthy();
    expect(word('kind').getAttribute('data-maybe')).toBe('true');
    expect(word('of.').getAttribute('data-filler')).toBe('true');
    expect(word('Um,').getAttribute('data-filler')).toBeNull();                        // a cut word is only struck through
    expect(word('this').getAttribute('title')).toBe('0:00.9');
    expect(screen.getByText('About 7.4 s of 6 s')).toBeTruthy();
    expect((screen.getByRole('combobox', { name: 'Video' }) as HTMLSelectElement).selectedOptions[0]?.textContent).toBe('Sample footage');
    expect(within(screen.getByRole('combobox', { name: 'Video' })).getByText('Second film (sent)')).toBeTruthy();
    expect(within(sentence(1)).getByRole('button', { name: 'Move up' }).hasAttribute('disabled')).toBe(true);
    expect(within(sentence(4)).getByRole('button', { name: 'Move down' }).hasAttribute('disabled')).toBe(true);
    expect(within(sentence(3)).getByRole('button', { name: 'Keep all' })).toBeTruthy();
    expect(within(sentence(1)).getByRole('button', { name: 'Cut sentence' })).toBeTruthy();
    expect(within(sentence(1)).getByRole('button', { name: 'Keep all' })).toBeTruthy();   // part cut: both are offered
    expect(within(sentence(2)).queryByRole('button', { name: 'Keep all' })).toBeNull();
  });

  it('cuts a word and brings it back by click and by keyboard, then saves', async () => {
    await open();
    fireEvent.click(word('second'));
    expect(word('second').getAttribute('aria-pressed')).toBe('true');
    expect(history.labels.undo).toBe('Cut the word “second”');
    fireEvent.keyDown(word('Um,'), { key: 'Enter' });
    fireEvent.keyDown(word('first'), { key: ' ' });
    expect(wordsOf(1)).toBe('Um, this is the first✂ sentence.');
    await settle(400);
    expect(posts.at(-1)?.url).toBe('/api/paper/save?job=demo');
    expect(posts.at(-1)?.body.blocks[0]?.words).toEqual([0, 1, 2, 3, 5]);
    expect(posts.at(-1)?.body.reviewer).toBe('Sam');
    expect(screen.getByText('Saved')).toBeTruthy();
    act(() => history.undo());
    expect(wordsOf(1)).toBe('Um, this is the first sentence.');
  });

  it('hears a word on Shift-click and Shift+Enter instead of cutting it', async () => {
    const hear = vi.spyOn(player, 'hear').mockResolvedValue();
    await open();
    fireEvent.click(word('second'), { shiftKey: true });
    fireEvent.keyDown(word('Um,'), { key: 'Enter', shiftKey: true });
    expect(hear.mock.calls).toEqual([['take-1', 9], ['take-1', 0]]);
    expect(word('second').getAttribute('aria-pressed')).toBe('false');
    expect(history.canUndo).toBe(false);
  });

  it('moves, cuts and restores sentences with the tools', async () => {
    await open();
    fireEvent.click(within(sentence(2)).getByRole('button', { name: 'Move up' }));
    expect(wordsOf(1)).toMatch(/^Here is a second/);
    fireEvent.click(within(sentence(1)).getByRole('button', { name: 'Move down' }));
    expect(wordsOf(2)).toMatch(/^Here is a second/);
    fireEvent.click(within(sentence(4)).getByRole('button', { name: 'To the start' }));
    expect(wordsOf(1)).toBe('We make videos very quickly.');
    fireEvent.click(within(sentence(1)).getByRole('button', { name: 'Cut sentence' }));
    expect(wordsOf(1)).toBe('We✂ make✂ videos✂ very✂ quickly.✂');
    fireEvent.click(within(sentence(1)).getByRole('button', { name: 'Keep all' }));
    expect(wordsOf(1)).toBe('We make videos very quickly.');
    fireEvent.click(within(sentence(2)).getByRole('button', { name: 'Keep all' }));
    expect(wordsOf(2)).toBe('Um, this is the first sentence.');
  });

  it('keeps a pause, approves a flagged join and takes both back', async () => {
    disk.check.joins.push(flaggedJoin);
    await open();
    const pause = screen.getByRole('button', { name: 'pause 1.2 s → 0.5 s' });
    fireEvent.click(pause);
    expect(screen.getByRole('button', { name: 'pause 1.2 s kept' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('About 7.4 s of 6 s · 1 join to check')).toBeTruthy();
    const flag = screen.getByRole('note');
    expect(flag.textContent).toContain('Check this join: joins words said apart inside a sentence; drops "one"');
    disk.check.joins = disk.check.joins.map((j) => (j.key === flaggedJoin.key ? { ...j, approved: true } : j));   // what the server will answer
    fireEvent.click(within(flag).getByRole('button', { name: 'It keeps the meaning' }));
    await settle(400);
    expect(posts.at(-1)?.body).toMatchObject({ keep_pauses: ['take-1:5'], approved_joins: [flaggedJoin.key] });
    expect(screen.getByRole('note').textContent).toContain('Approved: joins words said apart');
    expect(screen.getByText('About 7.4 s of 6 s')).toBeTruthy();
    fireEvent.click(within(screen.getByRole('note')).getByRole('button', { name: 'Undo' }));
    expect(paper.store.getState().approvedJoins).toEqual([]);
  });

  it('lists the opening ideas and the retakes, and opens with an idea', async () => {
    await open();
    const ideas = screen.getByRole('region', { name: 'Ideas for the opening line' });
    expect(within(ideas).getByText('short, says what it is')).toBeTruthy();
    expect(within(ideas).getByText('no strong signal')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Lines said more than once' }).textContent).toContain('take-2: said 2 times.');
    fireEvent.click(within(ideas).getAllByRole('button', { name: 'Open with it' })[1] as Element);   // the cut take
    expect(wordsOf(1)).toBe('We make videos quickly.');
    expect(history.labels.undo).toBe('Open with “We make videos quickly”');
  });

  it('sends as ready or with notes, and refuses "ready" while a join needs a look', async () => {
    disk.check.joins.push(flaggedJoin);
    await open();
    fireEvent.change(screen.getByLabelText('Anything for the editor'), { target: { value: 'Keep it warm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send: ready for the rough cut' }));
    await settle();
    expect(within(screen.getByRole('region', { name: 'When it reads right' })).getByRole('status').textContent).toBe('1 join still needs a look: each one is marked in the text.');
    expect(posts.filter((p) => p.url.includes('send'))).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Send with notes, not ready yet' }));
    await settle();
    expect(posts.at(-1)).toMatchObject({ url: '/api/paper/send?job=demo', body: { note: 'Keep it warm', approved: false, reviewer: 'Sam' } });
    expect(within(screen.getByRole('region', { name: 'When it reads right' })).getByRole('status').textContent).toBe('Sent with your notes.');
    expect(screen.getByText('Sent')).toBeTruthy();
    expect(within(screen.getByRole('combobox', { name: 'Video' })).getByText('Sample footage (sent)')).toBeTruthy();
  });

  it('plays and stops the edit with the buttons, the strip and Space, but not when Space is pressed on a word or a button', async () => {
    const play = vi.spyOn(player, 'playEdit').mockResolvedValue();
    const toggle = vi.spyOn(player, 'toggle').mockImplementation(() => {});
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Play the edit' }));
    fireEvent.click(screen.getByRole('button', { name: /^Stretch 2 of 2: take-2, 0:02.9 to 0:05.0/ }));
    expect(play.mock.calls).toEqual([[], [1]]);
    expect(handleKey({ key: ' ', target: document.body })).toBe(true);
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(handleKey({ key: ' ', target: word('second') })).toBe(false);              // Space on a word cuts that word instead
    expect(handleKey({ key: ' ', target: screen.getByRole('button', { name: 'Stop' }) })).toBe(false);
    expect(handleKey({ key: ' ', target: screen.getByLabelText('Anything for the editor') })).toBe(false);
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Shift-click to hear it/)).toBeTruthy();
  });

  it('hands its video element to the player once, not again on every re-draw', async () => {
    const attach = vi.spyOn(player, 'attach');
    await open();
    attach.mockClear();
    fireEvent.click(word('second'));
    act(() => { player.store.setState({ said: 'second', clip: 'take-1', time: 4.2 }); });   // what playing does many times a second
    act(() => { player.store.setState({ said: 'one,' }); });
    expect(attach).not.toHaveBeenCalled();
  });

  it('moves and cuts the sentence in focus with the keyboard', async () => {
    await open();
    word('second').focus();
    expect(handleKey({ key: 'ArrowUp', altKey: true, target: word('second') })).toBe(true);
    await settle(30);
    expect(wordsOf(1)).toMatch(/^Here is a second/);
    expect(document.activeElement?.closest('article')).toBe(sentence(1));             // focus went with the sentence
    act(() => { handleKey({ key: 'Backspace', altKey: true, target: document.activeElement }); });
    expect(wordsOf(1)).toMatch(/^Here✂ is✂/);
    act(() => { handleKey({ key: 'ArrowDown', altKey: true, target: document.activeElement }); });
    await settle(30);
    expect(wordsOf(2)).toMatch(/^Here✂ is✂/);
  });

  it('takes over the name typed on the old paper page, and opens another job from the list', async () => {
    useReviewer.setState({ name: '' }); localStorage.setItem('paper-who', 'Old Name');
    await open();
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Old Name');
    fireEvent.change(screen.getByRole('combobox', { name: 'Video' }), { target: { value: 'second' } });
    await settle(); await settle();
    expect(paper.store.getState().job).toBe('second');
    expect(new URLSearchParams(window.location.search).get('job')).toBe('second');
    expect(new URLSearchParams(window.location.search).get('mode')).toBe('paper');
  });

  it('says so in plain words when there are no paper edits', async () => {
    jobs = [];
    await open();
    expect(screen.getByText('No paper edits yet')).toBeTruthy();
    expect(screen.getByText(/once its footage is ingested and the first paper edit is made/)).toBeTruthy();
  });
});

describe('the switch between Review and Paper edit', () => {
  it('opens paper edit for ?mode=paper and goes back to review, keeping the address in step', async () => {
    await open(<App />);
    const group = screen.getByRole('radiogroup', { name: 'What to work on' });
    expect(within(group).getByRole('radio', { name: 'Paper edit' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getAllByRole('article')).toHaveLength(4);
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'What to work on' })).getByRole('radio', { name: 'Review' }));
    await settle(); await settle();
    expect(new URLSearchParams(window.location.search).get('mode')).toBeNull();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(within(screen.getByRole('radiogroup', { name: 'What to work on' })).getByRole('radio', { name: 'Review' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'What to work on' })).getByRole('radio', { name: 'Paper edit' }));
    await settle(); await settle();
    expect(new URLSearchParams(window.location.search).get('mode')).toBe('paper');
    expect(screen.getAllByRole('article')).toHaveLength(4);
  });

  it('opens review when the address does not ask for paper edit', async () => {
    window.history.replaceState(null, '', '/editor/?job=demo');
    await open(<App />);
    expect(within(screen.getByRole('radiogroup', { name: 'What to work on' })).getByRole('radio', { name: 'Review' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });
});

describe('the styles', () => {
  it('use only theme roles, no coding typeface and no dot grid', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('src/modes/paper/paper.css', 'utf8'); const tokens = readFileSync('src/theme/tokens.css', 'utf8');
    expect(css).not.toMatch(/mono|courier|consolas|menlo|radial-gradient|dotted/i);
    const used = [...new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1] ?? ''))];
    expect(used.length).toBeGreaterThan(10);
    for (const name of used) { expect(name.startsWith('--raw-'), name).toBe(false); expect(tokens.includes(`${name}:`), name).toBe(true); }
  });
});
