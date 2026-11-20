import { formatKeys, keyCaps } from './keys';

/** A shortcut drawn as key caps, read out as one phrase. */
export function KeyCaps({ keys, mac }: { keys: string; mac?: boolean }) {
  return (
    <span className="sc-keys" role="img" aria-label={formatKeys(keys, mac)}>
      {keyCaps(keys, mac).map((cap, i) => <kbd className="sc-key" key={i} aria-hidden="true">{cap}</kbd>)}
    </span>
  );
}
