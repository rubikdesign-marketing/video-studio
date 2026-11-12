/**
 * GENERATED from the live Tulvo DOM snapshots (research/ui-live/dom/*.html), path-for-path.
 * These are the app's own non-lucide SVG icons. Lucide icons come from lucide-react@0.479.0
 * (see icons.md). Third-party brand logos (Slack, Notion, Google) are deliberately NOT here:
 * use <IntegrationLogoSlot/> from ./IntegrationLogoSlot instead.
 */
import React from "react";

export type AppIconProps = {
  /** Overrides the intrinsic width/height attributes (CSS classes like w-4 h-4 still win). */
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
};

/** Sidebar header: collapse-sidebar toggle (16x16). Source: board-grid-pitch-sent.html, class="cursor-pointer shrink-0" */
export const CollapseSidebarIcon: React.FC<AppIconProps> = ({ size, className, style, title }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size ?? "16"} height={size ?? "16"} viewBox="0 0 16 16" fill="none" className={className} style={style} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M1.33398 8C1.33398 5.54058 1.33398 4.31087 1.87653 3.43918C2.07725 3.11668 2.32659 2.83618 2.61326 2.61036C3.38809 2 4.48116 2 6.66732 2H9.33398C11.5201 2 12.6132 2 13.388 2.61036C13.6747 2.83618 13.924 3.11668 14.1248 3.43918C14.6673 4.31087 14.6673 5.54058 14.6673 8C14.6673 10.4594 14.6673 11.6891 14.1248 12.5608C13.924 12.8833 13.6747 13.1638 13.388 13.3896C12.6132 14 11.5201 14 9.33398 14H6.66732C4.48116 14 3.38809 14 2.61326 13.3896C2.32659 13.1638 2.07725 12.8833 1.87653 12.5608C1.33398 11.6891 1.33398 10.4594 1.33398 8Z" stroke="currentColor" />
      <path d="M6.33398 2L6.33398 14" stroke="currentColor" strokeLinejoin="round" />
      <path d="M3.33398 4.66797H4.00065M3.33398 6.66797H4.00065" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Sidebar nav: Home (custom, stroke 1.5). Source: board-grid-pitch-sent.html, class="app-sidebar-icon w-4 h-4" */
export const HomeIcon: React.FC<AppIconProps> = ({ size, className, style, title }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size ?? "16"} height={size ?? "16"} viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 11.99v2.51c0 3.3 0 4.95 1.025 5.975S6.7 21.5 10 21.5h4c3.3 0 4.95 0 5.975-1.025S21 17.8 21 14.5v-2.51c0-1.682 0-2.522-.356-3.25s-1.02-1.244-2.346-2.276l-2-1.555C14.233 3.303 13.2 2.5 12 2.5s-2.233.803-4.298 2.409l-2 1.555C4.375 7.496 3.712 8.012 3.356 8.74S3 10.308 3 11.99M16 17H8" />
  </svg>
);

/** Sidebar nav + AI panel: Tulvo AI sparkle. Source: board-grid-pitch-sent.html, class="app-sidebar-icon w-4 h-4" */
export const TulvoAiIcon: React.FC<AppIconProps> = ({ size, className, style, title }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size ?? "16"} height={size ?? "16"} viewBox="0 0 16 16" fill="none" className={className} style={style} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path stroke="currentColor" d="M6.40039 4.07474C6.61498 3.53064 7.385 3.53064 7.5996 4.07474L8.20687 5.6144C8.59993 6.6111 9.38887 7.40007 10.3856 7.79313L11.9253 8.4004C12.4693 8.615 12.4693 9.385 11.9253 9.5996L10.3856 10.2069C9.38887 10.5999 8.59993 11.3889 8.20687 12.3856L7.5996 13.9253C7.385 14.4693 6.61498 14.4693 6.40039 13.9253L5.79316 12.3856C5.40007 11.3889 4.6111 10.5999 3.6144 10.2069L2.07474 9.5996C1.53064 9.385 1.53064 8.615 2.07474 8.4004L3.6144 7.79313C4.6111 7.40007 5.40007 6.6111 5.79316 5.6144L6.40039 4.07474Z" />
      <path stroke="currentColor" d="M12.1085 1.81969C12.1889 1.61566 12.4777 1.61566 12.5582 1.81969L12.7859 2.39707C12.9333 2.77083 13.2292 3.06669 13.6029 3.2141L14.1803 3.44181C14.3843 3.52229 14.3843 3.81105 14.1803 3.89152L13.6029 4.11923C13.2292 4.26664 12.9333 4.56251 12.7859 4.93627L12.5582 5.51364C12.4777 5.71767 12.1889 5.71767 12.1085 5.51364L11.8808 4.93627C11.7333 4.56251 11.4375 4.26664 11.0637 4.11923L10.4863 3.89152C10.2823 3.81105 10.2823 3.52229 10.4863 3.44181L11.0637 3.2141C11.4375 3.06669 11.7333 2.77083 11.8808 2.39707L12.1085 1.81969Z" />
  </svg>
);

/** Sidebar page items: tabler layout-grid (page icon). Source: board-grid-pitch-sent.html, class="tabler-icon tabler-icon-layout-grid app-sidebar-icon min-w-[18px] max-w-[18px] h-[18px] flex-shrink-0 cursor-pointer" */
export const TablerLayoutGrid: React.FC<AppIconProps> = ({ size, className, style, title }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size ?? "24"} height={size ?? "24"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" />
      <path d="M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" />
      <path d="M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" />
      <path d="M14 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" />
  </svg>
);

/** Template editor: tabler file-text. Source: template-edit-properties.html, class="tabler-icon tabler-icon-file-text !w-4 !h-4 text-muted-foreground" */
export const TablerFileText: React.FC<AppIconProps> = ({ size, className, style, title }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size ?? "24"} height={size ?? "24"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" />
      <path d="M9 9l1 0" />
      <path d="M9 13l6 0" />
      <path d="M9 17l6 0" />
  </svg>
);

/** Sidebar support card: envelope (16x16). Source: board-grid-pitch-sent.html, class="size-4" */
export const SupportEmailIcon: React.FC<AppIconProps> = ({ size, className, style, title }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size ?? "16"} height={size ?? "16"} viewBox="0 0 16 16" fill="none" className={className} style={style} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M4.66602 5.66699L6.62736 6.82659C7.77082 7.50266 8.22788 7.50266 9.37135 6.82659L11.3327 5.66699" />
      <path stroke="currentColor" strokeLinejoin="round" d="M1.3445 8.98341C1.38808 11.0271 1.40987 12.0489 2.16396 12.8059C2.91804 13.5629 3.96754 13.5892 6.06654 13.6419C7.36018 13.6745 8.64112 13.6745 9.93478 13.6419C12.0338 13.5892 13.0833 13.5629 13.8374 12.8059C14.5915 12.0489 14.6133 11.0271 14.6568 8.98341C14.6709 8.32628 14.6709 7.67308 14.6568 7.01594C14.6133 4.97225 14.5915 3.9504 13.8374 3.19345C13.0833 2.4365 12.0338 2.41013 9.93478 2.35739C8.64112 2.32488 7.36018 2.32488 6.06653 2.35738C3.96754 2.41012 2.91804 2.43648 2.16395 3.19344C1.40986 3.9504 1.38808 4.97224 1.34449 7.01594C1.33048 7.67308 1.33048 8.32628 1.3445 8.98341Z" />
  </svg>
);

/** Sidebar footer: Trash (custom, stroke 1.5). Source: board-grid-pitch-sent.html, class="w-4 h-4 app-sidebar-icon" */
export const TrashIcon: React.FC<AppIconProps> = ({ size, className, style, title }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size ?? "16"} height={size ?? "16"} viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" d="m19.5 5.5-.62 10.025c-.158 2.561-.237 3.842-.88 4.763a4 4 0 0 1-1.2 1.128c-.957.584-2.24.584-4.806.584c-2.57 0-3.855 0-4.814-.585a4 4 0 0 1-1.2-1.13c-.642-.922-.72-2.205-.874-4.77L4.5 5.5M3 5.5h18m-4.944 0-.683-1.408c-.453-.936-.68-1.403-1.071-1.695a2 2 0 0 0-.275-.172C13.594 2 13.074 2 12.035 2c-1.066 0-1.599 0-2.04.234a2 2 0 0 0-.278.18c-.395.303-.616.788-1.058 1.757L8.053 5.5m1.447 11v-6m5 6v-6" />
  </svg>
);

/** Board tabs: tab actions (dots, 15x15). Source: board-grid-pitch-sent.html, class="h-3.5 w-3.5" */
export const TabActionsIcon: React.FC<AppIconProps> = ({ size, className, style, title }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size ?? "15"} height={size ?? "15"} viewBox="0 0 15 15" fill="none" className={className} style={style} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M3.625 7.5C3.625 8.12132 3.12132 8.625 2.5 8.625C1.87868 8.625 1.375 8.12132 1.375 7.5C1.375 6.87868 1.87868 6.375 2.5 6.375C3.12132 6.375 3.625 6.87868 3.625 7.5ZM8.625 7.5C8.625 8.12132 8.12132 8.625 7.5 8.625C6.87868 8.625 6.375 8.12132 6.375 7.5C6.375 6.87868 6.87868 6.375 7.5 6.375C8.12132 6.375 8.625 6.87868 8.625 7.5ZM12.5 8.625C13.1213 8.625 13.625 8.12132 13.625 7.5C13.625 6.87868 13.1213 6.375 12.5 6.375C11.8787 6.375 11.375 6.87868 11.375 7.5C11.375 8.12132 11.8787 8.625 12.5 8.625Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
  </svg>
);

/** Board view switcher: kanban layout (app-made lucide-style icon). Source: board-kanban-prospecting.html, class="lucide lucide-kanban-layout" */
export const KanbanLayoutIcon: React.FC<AppIconProps> = ({ size, className, style, title }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size ?? "24"} height={size ?? "24"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M4 4h6" />
      <path d="M14 4h6" />
      <path d="M4 10a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M14 10a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
  </svg>
);

/** AI panel suggestion: What should I focus on? Source: data-templates-list.html, class="h-6 w-6 text-muted-foreground" */
export const AiFocusIcon: React.FC<AppIconProps> = ({ size, className, style, title }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size ?? "24"} height={size ?? "24"} viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M9.1304 2.5C6.4641 2.561 4.9068 2.815 3.8427 3.875C2.9115 4.803 2.6002 6.108 2.4961 8.2M14.8618 2.5C17.5281 2.561 19.0854 2.815 20.1495 3.875C21.0807 4.803 21.392 6.108 21.4961 8.2M14.8618 21.5C17.5281 21.439 19.0854 21.185 20.1495 20.125C21.0807 19.197 21.392 17.892 21.4961 15.8M9.1304 21.5C6.4641 21.439 4.9068 21.185 3.8427 20.125C2.9115 19.197 2.6002 17.892 2.4961 15.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.0039 12C16.0039 14.209 14.213 16 12.0039 16C9.7948 16 8.0039 14.209 8.0039 12C8.0039 9.791 9.7948 8 12.0039 8C14.213 8 16.0039 9.791 16.0039 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** AI panel suggestion: Outline a status report. Source: data-templates-list.html, class="h-6 w-6 text-muted-foreground" */
export const AiStatusReportIcon: React.FC<AppIconProps> = ({ size, className, style, title }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size ?? "24"} height={size ?? "24"} viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M8.004 17H16.004" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.004 13H12.004" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.996 2.5V3C12.996 5.828 12.996 7.243 13.875 8.121C14.753 9 16.168 9 18.996 9H19.496M19.996 10.657V14C19.996 17.771 19.996 19.657 18.824 20.828C17.653 22 15.767 22 11.996 22C8.225 22 6.339 22 5.168 20.828C3.996 19.657 3.996 17.771 3.996 14V9.456C3.996 6.211 3.996 4.588 4.882 3.489C5.061 3.267 5.263 3.065 5.485 2.886C6.584 2 8.207 2 11.452 2C12.157 2 12.51 2 12.833 2.114C12.9 2.138 12.966 2.165 13.031 2.196C13.34 2.344 13.589 2.593 14.088 3.092L18.824 7.828C19.403 8.406 19.692 8.696 19.844 9.063C19.996 9.431 19.996 9.839 19.996 10.657Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** AI panel suggestion: Ask about my workspace. Source: data-templates-list.html, class="h-6 w-6 text-muted-foreground" */
export const AiWorkspaceIcon: React.FC<AppIconProps> = ({ size, className, style, title }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size ?? "24"} height={size ?? "24"} viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M9.6096 4.813C10.7895 4.271 11.3794 4 12.0039 4C12.6284 4 13.2183 4.271 14.3982 4.813L19.2912 7.061C21.0997 7.891 22.0039 8.307 22.0039 9C22.0039 9.693 21.0997 10.109 19.2912 10.939L14.3982 13.187C13.2183 13.729 12.6284 14 12.0039 14C11.3794 14 10.7895 13.729 9.6096 13.187L4.7166 10.939C2.9081 10.109 2.0039 9.693 2.0039 9C2.0039 8.307 2.9081 7.891 4.7166 7.061L9.6096 4.813Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.2366 13.5C21.4148 14.062 22.0039 14.441 22.0039 15C22.0039 15.693 21.0997 16.109 19.2912 16.94L14.3982 19.187C13.2183 19.729 12.6284 20 12.0039 20C11.3794 20 10.7895 19.729 9.6096 19.187L4.7166 16.94C2.9081 16.109 2.0039 15.693 2.0039 15C2.0039 14.441 2.593 14.062 3.7712 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** AI panel suggestion: What can you help with? Source: data-templates-list.html, class="h-6 w-6 text-muted-foreground" */
export const AiHelpIcon: React.FC<AppIconProps> = ({ size, className, style, title }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size ?? "24"} height={size ?? "24"} viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M9.801 6.19C10.123 5.374 11.278 5.374 11.599 6.19L12.51 8.5C13.1 9.995 14.283 11.178 15.778 11.768L18.088 12.679C18.904 13.001 18.904 14.156 18.088 14.477L15.778 15.388C14.283 15.978 13.1 17.161 12.51 18.656L11.599 20.966C11.278 21.782 10.123 21.782 9.801 20.966L8.89 18.656C8.3 17.161 7.117 15.978 5.622 15.388L3.312 14.477C2.496 14.156 2.496 13.001 3.312 12.679L5.622 11.768C7.117 11.178 8.3 9.995 8.89 8.5L9.801 6.19Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M18.371 2.808C18.491 2.501 18.925 2.501 19.045 2.808L19.387 3.674C19.608 4.234 20.052 4.678 20.612 4.899L21.478 5.241C21.784 5.361 21.784 5.795 21.478 5.915L20.612 6.257C20.052 6.478 19.608 6.922 19.387 7.482L19.045 8.348C18.925 8.655 18.491 8.655 18.371 8.348L18.029 7.482C17.808 6.922 17.364 6.478 16.804 6.257L15.937 5.915C15.631 5.795 15.631 5.361 15.937 5.241L16.804 4.899C17.364 4.678 17.808 4.234 18.029 3.674L18.371 2.808Z" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);
