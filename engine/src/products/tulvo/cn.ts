/** Join class names, skipping falsy values. (The app uses clsx + tailwind-merge; we keep the
 * exact class strings from the DOM snapshots instead, so a plain join is all we need.) */
export const cn = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(" ");
