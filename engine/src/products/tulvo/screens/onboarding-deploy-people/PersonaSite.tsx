/**
 * The persona's deployed page (Callie Pembrook Studio media kit + "Run It Like a Studio" waitlist), as the
 * Deploy editor shows it. Source: research/ui-live/deploy-test/media-kit-waitlist.html (pasted into Deploy on
 * day 1; the editor iframe's srcdoc in the DOM snapshots carries the same markup and CSS).
 *
 * Rendered in an <iframe srcDoc>: a separate document, so the app's Tailwind preflight does not touch it.
 * Fonts follow the live editor: in Preview the page is an iframe, so `font-family: Inter, system-ui` falls back
 * to the OS UI font (Inter is not installed on the capture machine); in Edit mode the editor mounts the page in
 * the app document, where "Inter" is the app's web font (opsz variable): mode "container" declares the same
 * files as @font-face "Inter" (preloaded, so the iframe load event waits for them). Remotion's <IFrame> blocks
 * the frame until the document has loaded; the element is keyed by its content, so changing any prop (e.g. a
 * typed heading) remounts it under a fresh delayRender.
 *
 * All text is props (persona copy; no third-party names besides the channel labels as plain text).
 */
import React from "react";
import { IFrame, staticFile } from "remotion";
import { INTER_FILE, INTER_LATIN_RANGE } from "../../fonts";

export type PersonaSiteContent = {
  documentTitle: string;
  tag: string;
  heading: string;
  intro: string;
  pill: string;
  channels: string[];
  formTitle: string;
  formSubtitle: string;
  nameLabel: string;
  emailLabel: string;
  createLabel: string;
  createOptions: string[];
  /** Selected option shown in the closed <select>. */
  createValue: string;
  /** Typed values (a "fill the form" beat). */
  nameValue: string;
  emailValue: string;
  submitLabel: string;
};

export const PERSONA_SITE: PersonaSiteContent = {
  documentTitle: "Callie Pembrook Studio",
  tag: "Callie Pembrook Studio",
  heading: "Brand partnerships",
  intro: "Lifestyle stories for brands that care how they show up. Video series, Reels and a weekly newsletter, made by a small studio.",
  pill: "Now booking Holiday 2026",
  channels: ["YouTube", "Reels", "TikTok", "Newsletter"],
  formTitle: "Run It Like a Studio",
  formSubtitle: "A four-week live workshop. January 2027 cohort.",
  nameLabel: "Name",
  emailLabel: "Email",
  createLabel: "What do you create?",
  createOptions: ["Video", "Podcast", "Newsletter", "Photography", "Something else"],
  createValue: "Video",
  nameValue: "",
  emailValue: "",
  submitLabel: "Join the waitlist",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The page's own stylesheet, verbatim. */
const SITE_CSS = `
  body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #faf8f5; color: #141414; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 56px 24px; }
  .tag { display: inline-block; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: #6b6b6b; }
  h1 { font-size: 44px; line-height: 1.05; margin: 12px 0 16px; letter-spacing: -0.02em; }
  p { font-size: 18px; line-height: 1.6; color: #3d3d3d; }
  .pill { display: inline-block; background: #141414; color: #fff; border-radius: 999px; padding: 8px 16px; font-size: 14px; margin: 8px 0 32px; }
  .channels { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 40px; }
  .channels span { border: 1px solid #e3ded7; border-radius: 999px; padding: 6px 14px; font-size: 14px; background: #fff; }
  form { background: #fff; border: 1px solid #e8e3dc; border-radius: 16px; padding: 28px; }
  h2 { font-size: 24px; margin: 0 0 4px; }
  label { display: block; font-size: 14px; font-weight: 600; margin: 18px 0 6px; }
  input, select { width: 100%; box-sizing: border-box; padding: 12px 14px; border: 1px solid #ddd6cc; border-radius: 10px; font-size: 16px; background: #fff; }
  button { margin-top: 24px; width: 100%; padding: 14px; border: 0; border-radius: 10px; background: #141414; color: #fff; font-size: 16px; font-weight: 600; }
`;

export type SiteRenderMode =
  /** Preview (iframe document: body background fills the viewport). */
  | "document"
  /** Edit mode (the editor mounts the page in a container: the background covers the content only). */
  | "container"
  /** Project card thumbnail (adds the app's scrollbar-hiding style). */
  | "thumbnail";

/** The app's own Inter (the local opsz + wght variable file, see ../../fonts.ts), as the main document has it in Edit mode. */
// An absolute URL: the iframe is a separate document. Built on use, so staticFile() runs in the page.
const interUrl = (): string =>
  typeof window === "undefined" ? staticFile(INTER_FILE) : new URL(staticFile(INTER_FILE), window.location.href).href;
const appInterFaces = (): string =>
  `@font-face{font-family:Inter;font-style:normal;font-weight:100 900;font-display:block;src:url(${interUrl()}) format('woff2');unicode-range:${INTER_LATIN_RANGE};}`;
const appInterPreload = (): string => `<link rel="preload" as="font" type="font/woff2" crossorigin href="${interUrl()}">`;

export const buildSiteHtml = (c: PersonaSiteContent, mode: SiteRenderMode): string => {
  const extra =
    mode === "container"
      ? `html { background: #fff; }${appInterFaces()}`
      : mode === "thumbnail"
        ? "html,body{scrollbar-width:none;-ms-overflow-style:none}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none}"
        : "";
  const options = c.createOptions.map((o) => `<option${o === c.createValue ? " selected" : ""}>${esc(o)}</option>`).join("");
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${mode === "container" ? appInterPreload() : ""}
<title>${esc(c.documentTitle)}</title><style>${SITE_CSS}${extra}</style></head>
<body>
  <div class="wrap">
    <span class="tag">${esc(c.tag)}</span>
    <h1>${esc(c.heading)}</h1>
    <p>${esc(c.intro)}</p>
    <span class="pill">${esc(c.pill)}</span>
    <div class="channels">${c.channels.map((ch) => `<span>${esc(ch)}</span>`).join("")}</div>
    <form name="waitlist">
      <h2>${esc(c.formTitle)}</h2>
      <p style="margin:0;font-size:15px">${esc(c.formSubtitle)}</p>
      <label for="name">${esc(c.nameLabel)}</label>
      <input id="name" name="name" type="text" value="${esc(c.nameValue)}">
      <label for="email">${esc(c.emailLabel)}</label>
      <input id="email" name="email" type="email" value="${esc(c.emailValue)}">
      <label for="create">${esc(c.createLabel)}</label>
      <select id="create" name="create">${options}</select>
      <button type="submit">${esc(c.submitLabel)}</button>
    </form>
  </div>
</body></html>`;
};

const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

/** The site as an iframe document (srcDoc), sized by its parent. */
export const PersonaSiteFrame: React.FC<{
  content: PersonaSiteContent;
  mode: SiteRenderMode;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}> = ({ content, mode, className, style, title = "Uploaded website preview" }) => {
  const html = buildSiteHtml(content, mode);
  return <IFrame key={hash(html)} srcDoc={html} className={className} style={style} title={title} tabIndex={-1} aria-hidden={mode === "thumbnail" ? true : undefined} />;
};
