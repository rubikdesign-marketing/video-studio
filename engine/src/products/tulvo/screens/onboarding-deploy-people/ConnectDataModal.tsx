/**
 * Deploy → Database → "Connect Data" modal, connected state (Configure step), rebuilt from
 * research/ui-live/dom/deploy-database-panel.html (class strings verbatim; the `lg:hidden` mobile duplicates
 * of the nav and permissions are omitted). Matches day2/13.
 */
import React from "react";
import { Check, ChevronDown, Database, Eye, KeyRound, Layers, RefreshCw, Rows3, TriangleAlert, X } from "lucide-react";
import { DialogOverlay, Switch } from "./shared";

export type ConnectDataNavId = "configure" | "fieldSets" | "collections" | "connected";
export type ConnectDataField = { id: string; name: string; type: string; optionsLabel?: string; include: boolean };
export type ApiPermission = { id: "create" | "read" | "update" | "delete"; label: string; description: string; enabled: boolean; progress?: number | null };

export type ConnectDataModalProps = {
  activeNav: ConnectDataNavId;
  connectedCount: number;
  permissions: ApiPermission[];
  fieldSetName: string;
  /** "This field set will" select value. */
  fieldSetAction: string;
  templateName: string;
  /** Badge next to the field set name ("Connected"). */
  connected: boolean;
  fields: ConnectDataField[];
  maxItems: number;
  /** Content column scroll in px. */
  scrollTop: number;
  /** Save Changes hover look. */
  saveHover: boolean;
  opacity: number;
  labels: {
    title: string;
    navConfigure: string;
    navFieldSets: string;
    navCollections: string;
    navConnected: string;
    apiKeyPermissions: string;
    apiKeyHint: string;
    existingNoticeA: string;
    existingNoticeB: string;
    existingNoticeC: string;
    configure: string;
    configureSub: string;
    selectedFieldSets: string;
    selectedSub: string;
    connectedBadge: string;
    fieldSetNameLabel: string;
    fieldSetActionLabel: string;
    existingTemplateLabel: string;
    headFieldName: string;
    headType: string;
    headOptions: string;
    headInclude: string;
    maxItemsLabel: string;
    warning: string;
    warningSub: string;
    disconnectAll: string;
    cancel: string;
    saveChanges: string;
  };
};

const NAV_ON = "flex w-full items-center gap-2 rounded-md py-1.5 pl-2 pr-2 text-left text-sm transition-colors bg-white font-medium text-foreground dark:bg-white/10";
const NAV_OFF = "flex w-full items-center gap-2 rounded-md py-1.5 pl-2 pr-2 text-left text-sm transition-colors cursor-pointer text-foreground/80 hover:bg-white hover:text-accent-foreground dark:hover:bg-white/10";
const SWITCH =
  "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input";
const INPUT_BASE =
  "flex w-full rounded-md border border-input dark:bg-input/30 bg-transparent px-3 py-1 shadow-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary dark:focus-visible:ring-0 dark:focus-visible:border-[#3d3d3d] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";
const SELECT_BASE =
  "flex items-center justify-between whitespace-nowrap border border-input bg-transparent px-2 py-1 font-medium shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring dark:focus:ring-0 dark:focus:border-[#3d3d3d] disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1";
const TD = "align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] p-2";
const LABEL = "peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-xs font-medium text-muted-foreground";
const BTN =
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";

export const ConnectDataModal: React.FC<ConnectDataModalProps> = (p) => {
  const L = p.labels;
  const nav: Array<[ConnectDataNavId, React.ReactNode, string]> = [
    ["configure", <Database className="h-4 w-4 shrink-0" key="i" />, L.navConfigure],
    ["fieldSets", <Rows3 className="h-4 w-4 shrink-0" key="i" />, L.navFieldSets],
    ["collections", <Layers className="h-4 w-4 shrink-0" key="i" />, L.navCollections],
    ["connected", <RefreshCw className="h-4 w-4 shrink-0" key="i" />, `${L.navConnected} (${p.connectedCount})`],
  ];
  return (
    <>
      <DialogOverlay opacity={p.opacity} />
      <div
        className="fixed left-[50%] top-[50%] z-modal max-w-lg translate-x-[-50%] translate-y-[-50%] dark:bg-card dark:border-white/8 dark:shadow-[0_24px_64px_rgba(0,0,0,0.6),0_8px_24px_rgba(0,0,0,0.4)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg w-[95vw] md:w-full max-h-[90vh] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-white/15 z-[95] gap-0 overflow-hidden rounded-2xl border border-border bg-background p-0 shadow-lg lg:max-w-[1150px]"
        role="dialog"
        data-state="open"
        tabIndex={-1}
        style={{
          pointerEvents: "auto",
          opacity: p.opacity,
          // Live classes "!w-[90vw] lg:!w-[75vw]" resolved for the 1512 px window. As classes they break in a
          // 1080 px ad composition under a Tailwind v4 build (the old project had one; the engine has none), it emits its own !important copies (in a cascade layer,
          // which beats the app's unlayered !important rule) evaluated against the composition width.
          width: "calc(75 * var(--tulvo-vw))",
        }}
      >
        <div className="flex h-[85vh] max-h-[80vh] min-h-0 flex-1 flex-col lg:max-h-[715px] lg:flex-row" dir="ltr" data-orientation="horizontal">
          <aside className="hidden w-56 shrink-0 flex-col bg-secondary/90 lg:flex">
            <div className="flex flex-col text-center sm:text-left shrink-0 space-y-0 px-4 pb-3 pt-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center rounded-lg bg-primary shadow-lg">
                  <Database className="h-9 w-9 p-2 text-primary-foreground" />
                </div>
                <h2 className="font-semibold tracking-tight flex-1 text-base">{L.title}</h2>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
              <ul className="space-y-0.5">
                {nav.map(([id, icon, label]) => (
                  <li key={id}>
                    <button className={p.activeNav === id ? NAV_ON : NAV_OFF} type="button">
                      {icon}
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-4 border-t border-border/60 pt-4">
                <div className="mb-2 flex items-center gap-1.5 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <KeyRound className="h-3.5 w-3.5" />
                  {L.apiKeyPermissions}
                </div>
                <p className="mb-3 px-2 text-[11px] leading-snug text-muted-foreground">{L.apiKeyHint}</p>
                <div className="rounded-md bg-white/60 p-2.5 dark:bg-white/5">
                  <div className="space-y-3">
                    {p.permissions.map((perm) => (
                      <div className="flex items-center justify-between gap-3" key={perm.id}>
                        <div className="flex flex-col">
                          <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-sm font-normal" htmlFor={`api-key-perm-${perm.id}`}>
                            {perm.label}
                          </label>
                          <span className="text-xs text-muted-foreground">{perm.description}</span>
                        </div>
                        <Switch id={`api-key-perm-${perm.id}`} checked={perm.enabled} progress={perm.progress} className={SWITCH} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              className="ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 relative mt-0 hidden min-h-0 flex-1 flex-col data-[state=active]:flex"
              data-state="active"
              data-orientation="horizontal"
              role="tabpanel"
            >
              <p className="shrink-0 border-b border-border bg-muted/40 px-8 py-2 text-xs text-muted-foreground">
                {L.existingNoticeA}
                <span className="font-medium text-foreground">{L.existingNoticeB}</span>
                {L.existingNoticeC}
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-6 pt-6">
                <div style={p.scrollTop ? { transform: `translateY(${-p.scrollTop}px)` } : undefined}>
                  <div className="mb-4 shrink-0 space-y-1">
                    <h2 className="text-base font-semibold text-foreground">{L.configure}</h2>
                    <p className="text-sm text-muted-foreground">{L.configureSub}</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-4">
                      <div className="mt-4 space-y-1">
                        <p className="text-sm font-medium text-foreground">{`${L.selectedFieldSets} (1)`}</p>
                        <p className="text-xs text-muted-foreground">{L.selectedSub}</p>
                      </div>
                      <div className="space-y-3 rounded-xl border border-border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="min-w-0 truncate text-sm font-medium text-foreground">{p.fieldSetName}</span>
                          {p.connected ? (
                            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                              {L.connectedBadge}
                            </span>
                          ) : null}
                          <button className={`${BTN} disabled:opacity-50 hover:bg-accent hover:text-accent-foreground mr-2 ml-auto h-7 w-7 shrink-0 text-muted-foreground`} type="button" aria-label="Preview on page">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="space-y-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
                            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-[220px]">
                              <label className={LABEL}>{L.fieldSetNameLabel}</label>
                              <input className={`${INPUT_BASE} h-8 text-xs`} placeholder={p.fieldSetName} value={p.fieldSetName} readOnly />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className={LABEL}>{L.fieldSetActionLabel}</label>
                              <button className={`${SELECT_BASE} h-8 w-full rounded-md text-xs sm:w-[190px]`} type="button" role="combobox" aria-expanded="false" data-state="closed">
                                <span style={{ pointerEvents: "none" }}>{p.fieldSetAction}</span>
                                <ChevronDown className="h-4 w-4 opacity-50 ml-1" aria-hidden="true" />
                              </button>
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-[220px]">
                              <label className={LABEL}>{L.existingTemplateLabel}</label>
                              <div className="mb-0">
                                <button
                                  className="template-header flex w-full items-center justify-between border bg-card px-2 text-foreground disabled:cursor-not-allowed disabled:opacity-50 h-8 min-w-[200px] rounded-md text-xs"
                                  type="button"
                                  aria-haspopup="dialog"
                                  aria-expanded="false"
                                  data-state="closed"
                                >
                                  <span className="flex min-w-0 flex-1 items-center gap-2">
                                    <span className="truncate">{p.templateName}</span>
                                  </span>
                                  <ChevronDown className="template-header-icon h-4 w-4 shrink-0 transition-transform" />
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="max-h-56 overflow-y-auto rounded-lg border border-border [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-white/15">
                            <table className="w-full table-fixed text-xs">
                              <colgroup>
                                <col />
                                <col className="w-28" />
                                <col className="w-28" />
                                <col className="w-20" />
                              </colgroup>
                              <thead className="sticky top-0 z-10 bg-muted text-left text-muted-foreground">
                                <tr className="border-b border-border">
                                  <th className="h-auto p-2 align-middle text-[11px] font-semibold uppercase tracking-wide">{L.headFieldName}</th>
                                  <th className="h-auto p-2 align-middle text-[11px] font-semibold uppercase tracking-wide">{L.headType}</th>
                                  <th className="h-auto p-2 align-middle text-[11px] font-semibold uppercase tracking-wide">{L.headOptions}</th>
                                  <th className="h-auto p-2 text-center align-middle text-[11px] font-semibold uppercase tracking-wide">{L.headInclude}</th>
                                </tr>
                              </thead>
                              <tbody className="[&_tr:last-child]:border-0">
                                {p.fields.map((f) => (
                                  <tr className="data-[state=selected]:bg-muted border-b-0 transition-colors hover:bg-muted/50" key={f.id}>
                                    <td className={TD}>
                                      <input className={`${INPUT_BASE} h-7 text-xs`} value={f.name} readOnly />
                                    </td>
                                    <td className={TD}>
                                      <button className={`${SELECT_BASE} h-7 w-full rounded-md text-xs`} type="button" role="combobox" aria-expanded="false" data-state="closed">
                                        <span style={{ pointerEvents: "none" }}>{f.type}</span>
                                        <ChevronDown className="h-4 w-4 opacity-50 ml-1" aria-hidden="true" />
                                      </button>
                                    </td>
                                    <td className={TD}>
                                      {f.optionsLabel ? (
                                        <button
                                          className="inline-flex items-center gap-1 whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md h-7 w-full justify-start px-2 text-[11px] font-normal"
                                          type="button"
                                          aria-haspopup="dialog"
                                          data-state="closed"
                                        >
                                          {f.optionsLabel}
                                        </button>
                                      ) : null}
                                    </td>
                                    <td className="align-middle p-2 text-center [&:has([role=checkbox])]:pr-2 [&>[role=checkbox]]:translate-y-0">
                                      <button
                                        className="peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                                        type="button"
                                        role="checkbox"
                                        aria-checked={f.include}
                                        data-state={f.include ? "checked" : "unchecked"}
                                        value="on"
                                      >
                                        {f.include ? (
                                          <span className="flex items-center justify-center text-current" data-state="checked" style={{ pointerEvents: "none" }}>
                                            <Check className="h-4 w-4" />
                                          </span>
                                        ) : null}
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className={`${LABEL.replace(" text-xs", " mb-1 block text-xs")}`} htmlFor="connect-data-max-items">
                        {L.maxItemsLabel}
                      </label>
                      <input
                        id="connect-data-max-items"
                        className="flex h-9 rounded-md border border-input dark:bg-input/30 bg-transparent px-3 py-1 text-base shadow-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary dark:focus-visible:ring-0 dark:focus-visible:border-[#3d3d3d] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm w-24"
                        type="number"
                        value={p.maxItems}
                        readOnly
                      />
                    </div>
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400">
                      <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <div>
                        <p>{L.warning}</p>
                        <p className="mt-0.5 text-amber-700/70 dark:text-amber-400/70">{L.warningSub}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="shrink-0 border-t border-border bg-background px-6 py-5">
              <div className="flex flex-col-reverse sm:gap-2 sm:flex-row sm:space-x-2 gap-2 sm:justify-end">
                <button className={`${BTN} disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent h-9 px-4 py-2 mr-auto text-destructive hover:text-destructive`} type="button">
                  {L.disconnectAll}
                </button>
                <button className={`${BTN} disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2`} type="button">
                  {L.cancel}
                </button>
                <button
                  className={`${BTN} bg-primary text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none h-9 px-4 py-2`}
                  type="button"
                  style={p.saveHover ? { backgroundColor: "hsl(var(--primary) / 0.9)" } : undefined}
                >
                  {L.saveChanges}
                </button>
              </div>
            </div>
          </div>
        </div>
        <button
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          type="button"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </>
  );
};

export const CONNECT_DATA_LABELS: ConnectDataModalProps["labels"] = {
  title: "Connect Data",
  navConfigure: "Configure a Different Template",
  navFieldSets: "Detected Field Sets",
  navCollections: "Detected Collections",
  navConnected: "Connected Data",
  apiKeyPermissions: "API Key Permissions",
  apiKeyHint: "This key's secret will sit in the published page's source — grant only what it needs.",
  existingNoticeA: "This page has existing data connections — field sets already connected are marked ",
  existingNoticeB: "Connected",
  existingNoticeC:
    " below. Change a field set's Template, mapping, or skip it to disconnect that one field set, or use \"Disconnect All\" to remove every connection at once.",
  configure: "Configure",
  configureSub: "Review, customize, and connect your selected field sets to a Business Template.",
  selectedFieldSets: "Selected field sets",
  selectedSub: "Review the detected fields below, then connect.",
  connectedBadge: "Connected",
  fieldSetNameLabel: "Field set name",
  fieldSetActionLabel: "This field set will",
  existingTemplateLabel: "Existing Template",
  headFieldName: "Field Name",
  headType: "Type",
  headOptions: "Options",
  headInclude: "Include",
  maxItemsLabel: "Max items to show",
  warning: "The new API key's secret will be embedded in your published page's source.",
  warningSub: "Ensure this template only contains non-sensitive client data.",
  disconnectAll: "Disconnect All",
  cancel: "Cancel",
  saveChanges: "Save Changes",
};

export const API_PERMISSIONS_CAPTURED: ApiPermission[] = [
  { id: "create", label: "Create", description: "Submit new items", enabled: true },
  { id: "read", label: "Read", description: "View existing items", enabled: false },
  { id: "update", label: "Update", description: "Modify existing items", enabled: false },
  { id: "delete", label: "Delete", description: "Remove items", enabled: false },
];
