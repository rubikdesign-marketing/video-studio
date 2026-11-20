// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, Chip, Field, Segmented, Select, Sheet, Toasts, Tooltip, dismissToast, showToast, useToasts } from './index';

afterEach(() => {
  cleanup();
  useToasts.setState({ toasts: [] });
  vi.useRealTimers();
});

describe('Button', () => {
  it('has three looks and never submits a form by accident', () => {
    render(
      <>
        <Button>Plain</Button>
        <Button variant="primary">Main</Button>
        <Button variant="quiet">Quiet</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Plain' }).className).toContain('ui-button--default');
    expect(screen.getByRole('button', { name: 'Main' }).className).toContain('ui-button--primary');
    expect(screen.getByRole('button', { name: 'Quiet' }).className).toContain('ui-button--quiet');
    expect(screen.getByRole('button', { name: 'Plain' }).getAttribute('type')).toBe('button');
  });
});

describe('Chip', () => {
  it('is a label by default and a pressable button with onClick', () => {
    const onClick = vi.fn();
    render(
      <>
        <Chip>Scene 2</Chip>
        <Chip selected onClick={onClick}>
          Must fix
        </Chip>
      </>,
    );
    expect(screen.queryByRole('button', { name: 'Scene 2' })).toBeNull();
    const chip = screen.getByRole('button', { name: 'Must fix' });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Segmented', () => {
  function Demo() {
    const [value, setValue] = useState<'a' | 'b' | 'c'>('a');
    return (
      <Segmented
        label="Shape"
        value={value}
        onChange={setValue}
        options={[
          { value: 'a', label: 'Wide' },
          { value: 'b', label: 'Tall' },
          { value: 'c', label: 'Square' },
        ]}
      />
    );
  }

  it('moves with the arrow keys and keeps one stop in the tab order', () => {
    render(<Demo />);
    const radios = () => screen.getAllByRole('radio');
    expect(screen.getByRole('radiogroup', { name: 'Shape' })).toBeTruthy();
    expect(radios().map((radio) => radio.tabIndex)).toEqual([0, -1, -1]);

    fireEvent.keyDown(radios()[0] as HTMLElement, { key: 'ArrowRight' });
    expect(radios()[1]?.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(radios()[1]);

    fireEvent.keyDown(radios()[1] as HTMLElement, { key: 'End' });
    fireEvent.keyDown(radios()[2] as HTMLElement, { key: 'ArrowRight' });
    expect(radios()[0]?.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(radios()[2] as HTMLElement);
    expect(radios().map((radio) => radio.tabIndex)).toEqual([-1, -1, 0]);
  });
});

describe('Select and Field', () => {
  it('tie the label to the control and report changes', () => {
    const onPick = vi.fn();
    const onType = vi.fn();
    render(
      <>
        <Select<'preview' | 'master'> label="Quality" value="preview" onChange={onPick} options={[{ value: 'preview', label: 'Preview' }, { value: 'master', label: 'Master' }]} />
        <Field label="Words" value="" onChange={onType} hint="Seven words at most." />
        <Field label="Note" multiline value="" onChange={onType} error="Write a note first." />
      </>,
    );
    fireEvent.change(screen.getByLabelText('Quality'), { target: { value: 'master' } });
    expect(onPick).toHaveBeenCalledWith('master');

    const words = screen.getByLabelText('Words');
    expect(words.tagName).toBe('INPUT');
    expect(document.getElementById(words.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Seven words at most.');
    fireEvent.change(words, { target: { value: 'Hello' } });
    expect(onType).toHaveBeenCalledWith('Hello');

    const note = screen.getByLabelText('Note');
    expect(note.tagName).toBe('TEXTAREA');
    expect(note.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Write a note first.');
  });
});

describe('Tooltip', () => {
  it('shows on focus and on hover, and hides on Escape', () => {
    render(
      <Tooltip label="Nothing to undo">
        <Button>Undo</Button>
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'Undo' });
    const tip = document.getElementById(button.getAttribute('aria-describedby') ?? '') as HTMLElement;
    expect(tip.textContent).toBe('Nothing to undo');
    expect(tip.hidden).toBe(true);

    fireEvent.focus(button);
    expect(tip.hidden).toBe(false);
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(tip.hidden).toBe(true);

    fireEvent.mouseEnter(button.parentElement as HTMLElement);
    expect(tip.hidden).toBe(false);
    fireEvent.mouseLeave(button.parentElement as HTMLElement);
    expect(tip.hidden).toBe(true);
  });
});

describe('Toast', () => {
  it('shows a message, lets it be dismissed, and leaves by itself', () => {
    vi.useFakeTimers();
    render(<Toasts />);
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');

    act(() => void showToast('Notes sent.', { tone: 'good' }));
    expect(screen.getByText('Notes sent.')).toBeTruthy();
    act(() => void vi.advanceTimersByTime(5000));
    expect(screen.queryByText('Notes sent.')).toBeNull();

    let id = 0;
    act(() => void (id = showToast('Kept until dismissed.', { duration: 0 })));
    act(() => void vi.advanceTimersByTime(60_000));
    expect(screen.getByText('Kept until dismissed.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Kept until dismissed.')).toBeNull();
    act(() => dismissToast(id));
  });
});

describe('Sheet', () => {
  function Demo({ onClose }: { onClose?: () => void }) {
    const [open, setOpen] = useState(false);
    const close = () => {
      setOpen(false);
      onClose?.();
    };
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open</Button>
        <Sheet open={open} onClose={close} title="Shortcuts" footer={<Button onClick={close}>Done</Button>}>
          <Button>Inside</Button>
        </Sheet>
      </>
    );
  }
  const tab = (shiftKey = false) => fireEvent.keyDown(document.activeElement as Element, { key: 'Tab', shiftKey });

  it('is a labelled modal that takes focus and gives it back', () => {
    render(<Demo />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Shortcuts' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(dialog);

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('keeps Tab inside', () => {
    render(<Demo />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const close = screen.getByRole('button', { name: 'Close' });
    const done = screen.getByRole('button', { name: 'Done' });

    // From the sheet itself, Shift+Tab goes to the last control.
    tab(true);
    expect(document.activeElement).toBe(done);
    // From the last control, Tab wraps to the first.
    tab();
    expect(document.activeElement).toBe(close);
    // From the first control, Shift+Tab wraps to the last.
    tab(true);
    expect(document.activeElement).toBe(done);
  });

  it('closes from the Close button and from a click outside', () => {
    const onClose = vi.fn();
    render(<Demo onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.click(document.querySelector('.ui-sheet-scrim') as Element);
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
