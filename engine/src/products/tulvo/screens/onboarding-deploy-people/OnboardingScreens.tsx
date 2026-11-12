/**
 * Onboarding, rebuilt from research/ui-live/dom/onboarding-empty.html + onboarding-ai-active.html (markup and
 * class strings verbatim) and, for states with no DOM (typed fields, availability line, focus, the progress
 * screen), from the compiled app bundle (research/ui-capture/app-bundle/app-index.js: the onboarding page
 * component and the progress card `JDe` with its 7 steps and ceilings). Screens:
 *   - OnboardingWorkScreen     "Tell us about your work"
 *   - OnboardingProgressScreen "Setting up your workspace"
 */
import React from "react";
import { Img } from "remotion";
import { Check, Loader2, Lock, Sparkles } from "lucide-react";
import { ONBOARDING_STEPS, SUGGESTED_WORKFLOWS } from "../../fixtures";
import { ONBOARDING_PANEL_BG } from "./assets";
import { WHITE_SYMBOL_SVG } from "./app-svgs";
import { CaretMirror, CookieSettingsButton, Switch, typed } from "./shared";

// ------------------------------------------------------------------------------------------------ frame

type OnboardingFrameProps = {
  brandLabel: string;
  /** Vertical scroll of the left column in px (animate for a scroll). */
  scrollTop: number;
  /** Form phase shows a fade at the bottom of the left column; the progress phase does not. */
  bottomFade: boolean;
  showCookieSettings: boolean;
  children: React.ReactNode;
};

/** The onboarding page skeleton: logo header + scroll column (left), blurred artwork panel (right). */
const OnboardingFrame: React.FC<OnboardingFrameProps> = ({ brandLabel, scrollTop, bottomFade, showCookieSettings, children }) => (
  <>
    <div className="fixed inset-0 bg-white dark:bg-background z-[100] overflow-hidden flex flex-col items-center justify-center ">
      <div className="mx-auto flex h-full w-full max-w-[1440px] gap-2 overflow-hidden rounded-2xl bg-card">
        <div className="relative flex min-w-0 w-full lg:w-1/2 flex-col">
          <div className="w-full shrink-0 bg-card px-10 pt-10 pb-6 flex flex-col items-center">
            <div className="flex w-full max-w-[581px] items-center gap-2 shrink-0">
              <Img src={WHITE_SYMBOL_SVG} alt="" className="size-6 shrink-0 rounded-lg" />
              <span className="text-sm font-medium text-foreground">{brandLabel}</span>
            </div>
          </div>
          <div className="flex flex-1 min-h-0 flex-col overflow-y-auto scrollbar-hide">
            <div
              className="w-full min-h-full px-10 pb-10 flex flex-col items-center"
              style={scrollTop ? { transform: `translateY(${-scrollTop}px)` } : undefined}
            >
              <div className="flex w-full flex-1 flex-col items-center">
                <div className="m-auto flex w-full max-w-[581px] flex-col gap-6">{children}</div>
              </div>
            </div>
          </div>
          {bottomFade ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-2xl bg-gradient-to-b from-transparent to-card" />
          ) : null}
        </div>
        <div className="hidden lg:block w-1/2 shrink-0 overflow-hidden rounded-2xl p-2">
          <div className="h-full w-full overflow-hidden rounded-2xl">
            {/* The app shows /assets/onboarding-panel-bg-*.jpg with `scale-125 object-cover blur-2xl`;
                ONBOARDING_PANEL_BG is that result as displayed, so no extra scale/blur here. */}
            <Img src={ONBOARDING_PANEL_BG} alt="" className="h-full w-full object-cover" />
          </div>
        </div>
      </div>
    </div>
    {showCookieSettings ? <CookieSettingsButton /> : null}
  </>
);

// ------------------------------------------------------------------------------------------------ "Tell us about your work"

const LABEL = "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70";
const INPUT =
  "flex w-full border border-input dark:bg-input/30 bg-transparent px-3 py-1 text-base shadow-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary dark:focus-visible:ring-0 dark:focus-visible:border-[#3d3d3d] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm h-8 rounded-[10px]";
const TEXTAREA =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:focus-visible:ring-0 dark:focus-visible:border-[#3d3d3d] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm min-h-[64px] resize-none pb-6 disabled:bg-muted";
const SWITCH =
  "peer inline-flex h-5 w-9 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input mt-0.5 shrink-0";
const BTN_CANCEL =
  "inline-flex items-center justify-center gap-1 whitespace-nowrap font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground px-4 py-2 flex-1 h-8 rounded-[10px] text-sm";
const BTN_START =
  "inline-flex items-center justify-center gap-1 whitespace-nowrap font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none px-4 py-2 flex-1 h-8 rounded-[10px] text-sm";

/** :focus-visible look of the app's Input (ring-2 primary/20 + primary border) and Textarea (ring-1 ring). */
const INPUT_FOCUS: React.CSSProperties = {
  borderColor: "hsl(var(--primary))",
  boxShadow: "0 0 0 2px hsl(var(--primary) / 0.2), 0 1px 2px 0 rgb(0 0 0 / 0.05)",
};
const TEXTAREA_FOCUS: React.CSSProperties = { boxShadow: "0 0 0 1px hsl(var(--ring)), 0 1px 2px 0 rgb(0 0 0 / 0.05)" };
const INPUT_MIRROR: React.CSSProperties = { display: "flex", alignItems: "center", padding: "0 13px", fontSize: 14, lineHeight: "20px" };
const TEXTAREA_MIRROR: React.CSSProperties = { padding: "9px 13px 25px 13px", fontSize: 14, lineHeight: "20px" };

export type OnboardingField = "workspaceName" | "workType" | "description";
export type StartCreatingState = "auto" | "disabled" | "enabled" | "hover" | "pressed";

export type OnboardingWorkScreenProps = {
  brandLabel: string;
  title: string;
  subtitle: string;
  labels: {
    workspaceName: string;
    workspaceSetup: string;
    workType: string;
    description: string;
    suggestedWorkflows: string;
    cancel: string;
    startCreating: string;
    secure: string;
  };
  placeholders: { workspaceName: string; workType: string; description: string };
  setupCopy: {
    ai: { title: string; badge: string; description: string };
    basic: { title: string; badge: string; description: string };
  };
  workspaceName: string;
  /** Typing animation: characters of `workspaceName` shown (null = all). */
  workspaceNameTypedChars: number | null;
  /** Availability line under the name: "<name> is available" (live wording), or hidden. */
  showNameAvailable: boolean;
  availableSuffix: string;
  /** Workspace Setup switch: Use Tulvo AI (true) / Basic Workspace (false). */
  useAi: boolean;
  /** Animates the switch knob/track 0..1 (null = follow useAi). The copy follows `useAi`. */
  switchProgress: number | null;
  workType: string;
  workTypeTypedChars: number | null;
  description: string;
  descriptionTypedChars: number | null;
  /** Counter limit ("0/3000"). */
  descriptionLimit: number;
  suggestedWorkflows: ReadonlyArray<{ title: string; description: string }>;
  /** Index of a workflow card shown in its hover state (null = none). */
  hoveredWorkflow: number | null;
  /** Focused field (focus ring) and whether its text caret is drawn (blink = toggle this). */
  focusedField: OnboardingField | null;
  caretVisible: boolean;
  /** "auto" = the app's rule (enabled when name and, with AI, work type + description are filled). */
  startCreating: StartCreatingState;
  showCancel: boolean;
  /** Left column scroll in px. */
  scrollTop: number;
  showCookieSettings: boolean;
};

export const OnboardingWorkScreen: React.FC<OnboardingWorkScreenProps> = (p) => {
  const name = typed(p.workspaceName, p.workspaceNameTypedChars);
  const workType = typed(p.workType, p.workTypeTypedChars);
  const description = typed(p.description, p.descriptionTypedChars);
  const copy = p.useAi ? p.setupCopy.ai : p.setupCopy.basic;
  const autoEnabled = name.trim().length >= 1 && (!p.useAi || (workType.trim().length > 0 && description.trim().length > 0));
  const startState = p.startCreating === "auto" ? (autoEnabled ? "enabled" : "disabled") : p.startCreating;
  const focus = (f: OnboardingField) => p.focusedField === f;

  return (
    <OnboardingFrame brandLabel={p.brandLabel} scrollTop={p.scrollTop} bottomFade showCookieSettings={p.showCookieSettings}>
      <div className="flex flex-col gap-12 py-6 w-full">
        <div className="flex flex-col gap-2 w-[296px]">
          <h1 className="text-2xl font-medium text-foreground leading-8">{p.title}</h1>
          <p className="text-xs text-muted-foreground leading-4">{p.subtitle}</p>
        </div>
        <div className="flex flex-col gap-8 w-full">
          {/* Workspace Name */}
          <div className="flex flex-col gap-2">
            <label className={LABEL} htmlFor="ws-name-unified">
              {p.labels.workspaceName}
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="ws-name-unified"
                className={INPUT}
                placeholder={p.placeholders.workspaceName}
                value={name}
                readOnly
                style={focus("workspaceName") ? INPUT_FOCUS : undefined}
              />
              <CaretMirror text={name} style={INPUT_MIRROR} visible={focus("workspaceName") && p.caretVisible} />
            </div>
            {p.showNameAvailable && name.trim() ? (
              <div className="flex items-center gap-2 text-xs transition-opacity duration-150 text-[#0090FF] opacity-100">
                <span>{`${name}${p.availableSuffix}`}</span>
              </div>
            ) : null}
          </div>
          {/* Workspace Setup */}
          <div className="flex flex-col gap-2">
            <label className={LABEL} htmlFor="workspace-setup-toggle">
              {p.labels.workspaceSetup}
            </label>
            <div className="rounded-[18px] border border-border bg-card p-4 transition-all">
              <div className="flex items-start justify-between gap-10">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[#F5F5F5]">
                    <Sparkles className="h-5 w-5 text-[#737373]" />
                  </div>
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{copy.title}</span>
                      <div className="flex h-[22px] items-center justify-center rounded-full bg-[#F5F5F5] px-2">
                        <span className="text-xs font-medium text-[#737373] whitespace-nowrap">{copy.badge}</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#737373] overflow-hidden text-ellipsis whitespace-nowrap">{copy.description}</p>
                  </div>
                </div>
                <Switch id="workspace-setup-toggle" checked={p.useAi} progress={p.switchProgress} className={SWITCH} />
              </div>
            </div>
          </div>
          {/* Work Type + Description */}
          <div className={p.useAi ? "flex flex-col gap-8 transition-all duration-300" : "flex flex-col gap-8 transition-all duration-300 opacity-70"}>
            <div className="flex flex-col gap-2">
              <label className={LABEL} htmlFor="work-type">
                {p.labels.workType}
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="work-type"
                  className={`${INPUT} disabled:bg-muted`}
                  placeholder={p.placeholders.workType}
                  disabled={!p.useAi}
                  value={workType}
                  readOnly
                  style={focus("workType") ? INPUT_FOCUS : undefined}
                />
                <CaretMirror text={workType} style={INPUT_MIRROR} visible={focus("workType") && p.caretVisible} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className={LABEL} htmlFor="description">
                {p.labels.description}
              </label>
              <div className="relative">
                <textarea
                  id="description"
                  className={TEXTAREA}
                  placeholder={p.placeholders.description}
                  disabled={!p.useAi}
                  value={description}
                  readOnly
                  style={focus("description") ? TEXTAREA_FOCUS : undefined}
                />
                <CaretMirror text={description} style={TEXTAREA_MIRROR} multiline visible={focus("description") && p.caretVisible} />
                <span className="pointer-events-none absolute bottom-2 right-3 text-xs tabular-nums text-muted-foreground">
                  {`${description.length}/${p.descriptionLimit}`}
                </span>
              </div>
            </div>
          </div>
          {/* Suggested workflows (AI only) */}
          {p.useAi ? (
            <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className={LABEL}>{p.labels.suggestedWorkflows}</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {p.suggestedWorkflows.map((w, i) => (
                  <div
                    key={w.title}
                    className="rounded-xl border p-4 cursor-pointer transition-all hover:shadow-sm border-border bg-card hover:border-primary/30"
                    style={
                      p.hoveredWorkflow === i
                        ? { boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)", borderColor: "hsl(var(--primary) / 0.3)" }
                        : undefined
                    }
                  >
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      <span>{w.title}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{w.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {/* Buttons */}
          <div className="flex items-center gap-3">
            {p.showCancel ? <button className={BTN_CANCEL}>{p.labels.cancel}</button> : null}
            <button
              className={BTN_START}
              disabled={startState === "disabled"}
              style={startState === "hover" || startState === "pressed" ? { backgroundColor: "hsl(var(--primary) / 0.9)" } : undefined}
            >
              {p.labels.startCreating}
            </button>
          </div>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            {p.labels.secure}
          </p>
        </div>
      </div>
    </OnboardingFrame>
  );
};

export const ONBOARDING_WORK_DEFAULTS: Omit<
  OnboardingWorkScreenProps,
  | "workspaceName"
  | "workspaceNameTypedChars"
  | "showNameAvailable"
  | "useAi"
  | "switchProgress"
  | "workType"
  | "workTypeTypedChars"
  | "description"
  | "descriptionTypedChars"
  | "hoveredWorkflow"
  | "focusedField"
  | "caretVisible"
  | "startCreating"
  | "scrollTop"
  | "showCookieSettings"
> = {
  brandLabel: "Tulvo",
  title: "Tell us about your work",
  subtitle: "Describe your work type and specific requirements.",
  labels: {
    workspaceName: "Workspace Name",
    workspaceSetup: "Workspace Setup",
    workType: "Work Type",
    description: "Description",
    suggestedWorkflows: "Suggested workflows",
    cancel: "Cancel",
    startCreating: "Start Creating",
    secure: "Your data is secure and encrypted.",
  },
  placeholders: {
    workspaceName: "Enter a name for your workspace",
    workType: "E.g Software Company, Real Estate, Marketing Agency etc",
    description: "Describe your work and specific requirements...",
  },
  setupCopy: {
    ai: { title: "Use Tulvo AI", badge: "AI Active", description: "Tulvo AI automatically generates templates, boards, tasks, and widgets." },
    basic: { title: "Basic Workspace", badge: "Manual setup", description: "Create an empty workspace that can be configured manually later." },
  },
  availableSuffix: " is available",
  descriptionLimit: 3000,
  suggestedWorkflows: SUGGESTED_WORKFLOWS,
  showCancel: true,
};

// ------------------------------------------------------------------------------------------------ "Setting up your workspace"

/** Step ceilings of the AI setup (bundle `KDe`): a step is active while progress < its ceiling. */
export const ONBOARDING_STEP_CEILINGS = [12, 26, 44, 60, 74, 86, 97] as const;

type StepState = "done" | "active" | "pending";

export type OnboardingProgressScreenProps = {
  brandLabel: string;
  /** "preparing" while it runs; "ready" = the app's finished state (all done, "You're all set!"). */
  phase: "preparing" | "ready";
  /** Raw progress 0..100 (float). Shown rounded; the active step follows the app's ceilings. */
  progress: number;
  steps: ReadonlyArray<string>;
  ceilings: ReadonlyArray<number>;
  copy: {
    title: string;
    subtitle: string;
    readyTitle: string;
    readySubtitle: string;
    readyLabel: string;
    pleaseWait: string;
    entering: string;
  };
  /** Rotation of the spinners in degrees (the app spins them with animate-spin, 1 turn/s). */
  spinnerAngle: number;
  /** "Please Wait..." dot ping, 0..1 (animate-ping: 1 cycle/s). */
  pingProgress: number;
  scrollTop: number;
  showCookieSettings: boolean;
};

const easeOutPing = (t: number) => 1 - Math.pow(1 - t, 3);

export const OnboardingProgressScreen: React.FC<OnboardingProgressScreenProps> = (p) => {
  const ready = p.phase === "ready";
  const pct = Math.min(100, Math.round(p.progress));
  const idx = ready ? p.steps.length - 1 : (() => {
    const i = p.ceilings.findIndex((c) => p.progress < c);
    return i === -1 ? p.steps.length - 1 : i;
  })();
  const stateOf = (i: number): StepState => (ready || i < idx ? "done" : i > idx ? "pending" : "active");
  const title = ready ? p.copy.readyTitle : p.copy.title;
  const subtitle = ready ? p.copy.readySubtitle : p.copy.subtitle;
  const label = ready ? p.copy.readyLabel : p.steps[idx];
  const spin: React.CSSProperties = { transform: `rotate(${p.spinnerAngle}deg)` };
  const ping = easeOutPing(Math.min(1, Math.max(0, p.pingProgress) / 0.75));

  return (
    <OnboardingFrame brandLabel={p.brandLabel} scrollTop={p.scrollTop} bottomFade={false} showCookieSettings={p.showCookieSettings}>
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px]">
        <div className="max-w-md mx-auto w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="w-full rounded-2xl bg-card p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 pt-0.5">
                <h2 className="text-base font-bold leading-tight text-foreground">{title}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
              </div>
            </div>
            <div className="mt-8 space-y-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <span className="flex items-center gap-1.5 text-foreground">
                  {ready ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-green-500 dark:text-green-400" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" style={spin} />
                  )}
                  {label}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {pct}
                  {"%"}
                </span>
              </div>
              <div data-slot="progress" className="bg-accent relative w-full overflow-hidden rounded-full h-1.5 [&>div]:bg-blue-600 dark:[&>div]:bg-blue-500">
                <div
                  data-slot="progress-indicator"
                  className="bg-primary h-full w-full flex-1 transition-all"
                  style={{ transform: `translateX(-${100 - (pct || 0)}%)` }}
                />
              </div>
            </div>
            <ul className="mt-5">
              {p.steps.map((s, i) => {
                const st = stateOf(i);
                const last = i === p.steps.length - 1;
                const line = !last && st === "done";
                const dot =
                  st === "done"
                    ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors border-green-500 bg-green-500 text-white dark:border-green-400 dark:bg-green-400"
                    : st === "active"
                      ? "flex h-5 w-5 shrink-0 items-center justify-center text-primary"
                      : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors border-slate-200 text-transparent dark:border-slate-700";
                const text = [
                  "text-sm",
                  last ? "pb-0" : "pb-4",
                  st === "active" ? "font-medium text-foreground" : st === "done" ? "text-foreground" : "text-muted-foreground",
                ].join(" ");
                return (
                  <li className="flex gap-3" key={s}>
                    <div className="flex flex-col items-center">
                      <span className={dot}>
                        {st === "done" ? <Check className="h-3 w-3" /> : null}
                        {st === "active" ? <Loader2 className="h-5 w-5 animate-spin" style={spin} /> : null}
                        {st === "pending" ? <span className="h-1 w-1 rounded-full bg-current" /> : null}
                      </span>
                      {!last ? (
                        <span className={`my-0.5 w-px flex-1 transition-colors ${line ? "bg-green-500 dark:bg-green-400" : "bg-transparent"}`} />
                      ) : null}
                    </div>
                    <p className={text}>{s}</p>
                  </li>
                );
              })}
            </ul>
          </div>
          {ready ? (
            <button
              type="button"
              className="mx-auto flex items-center justify-center gap-2 py-2 text-sm font-medium text-green-600 transition-opacity hover:opacity-80 dark:text-green-400"
            >
              <Check className="h-4 w-4" />
              {p.copy.entering}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2.5 py-2 text-sm font-medium text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60"
                  style={{ transform: `scale(${1 + ping})`, opacity: 1 - ping }}
                />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              {p.copy.pleaseWait}
            </div>
          )}
        </div>
      </div>
    </OnboardingFrame>
  );
};

export const ONBOARDING_PROGRESS_DEFAULTS: Pick<OnboardingProgressScreenProps, "brandLabel" | "steps" | "ceilings" | "copy"> = {
  brandLabel: "Tulvo",
  steps: ONBOARDING_STEPS,
  ceilings: ONBOARDING_STEP_CEILINGS,
  copy: {
    title: "Setting up your workspace",
    subtitle: "Almost there — your workspace is on its way.",
    readyTitle: "You're all set!",
    readySubtitle: "Redirecting you to your new workspace…",
    readyLabel: "Workspace ready",
    pleaseWait: "Please Wait...",
    entering: "Entering Workspace...",
  },
};
