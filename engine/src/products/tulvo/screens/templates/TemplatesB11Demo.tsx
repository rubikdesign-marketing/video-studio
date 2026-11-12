/**
 * Reference driver for the ad's B11 beat ("This time I added one field."): shows how the motion
 * team animates the pure templates screens from useCurrentFrame(). Not a final shot: timing,
 * camera, the pointer and the "+1" badge / option pills belong to the shot composition.
 *
 * Built around the script's S49/S50 cut (script-v1 B11: S49 76.85-78.20 typing, S50 78.20-80.55):
 *
 *   0-29     Data Templates (Month-3 list), Brand Deals in the quick look; pointer over "Edit properties"
 *   30       S49: Edit properties (Status selected with its 7 values, "Add new property..." focused)
 *   32-67    types "Usage Rights" (charFrames per character); pointer in the properties column -> thumb
 *   71       HARD CUT (S49/S50, 78.20 s). After the cut: Usage Rights added and selected, Dropdown,
 *            its first option "30 days" already in the list, "Add new option..." focused and empty,
 *            the list scrolled to the new (last) row, Update Template enabled.
 *   73-      "90 days", "12 months", "Perpetual" typed and added one by one (optionCharFrames per char)
 *   then     Update Template hovered, clicked; after the click the app disables it (saving, then nothing
 *            left to save). Its "Template updated successfully" toast is not rebuilt (not captured).
 *
 * What the cut hides (do not show it uncut): pressing Enter adds the property as "text" (Configure
 * shows "Text Input"), the list does NOT scroll to it by itself, the Input Type menu is opened and
 * Dropdown picked ("0 Values Single"). Those states are now captured or read from the app's code
 * (TemplateEditProperties-TextInput, -InputTypeMenu, templates.md "Fix pass"); an uncut version
 * still needs the live B11 rehearsal (script open item 5) before it is used.
 */
import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { MONTH3_SIDEBAR, tulvoFixtures } from "../../fixtures";
import type { TulvoUiScreen } from "../types";
import { templatesFixtures, USAGE_RIGHTS_FIELD } from "./data";
import { DataTemplatesScreen, TemplateEditPropertiesScreen, type TemplatesShellProps } from "./TemplatesScreens";

export type TemplatesB11DemoProps = {
  /** Frames per typed character of the property name (S49). */
  charFrames: number;
  /** Frames per typed character of each option (S50). Lower it to land the adds on the script's pills. */
  optionCharFrames: number;
};

// Month-3 sidebar: no Day-1 "Workshop Interest Tracker" next to "Run It Like a Studio" (SL-6).
const shell: TemplatesShellProps = {
  workspace: tulvoFixtures.workspace,
  sidebar: MONTH3_SIDEBAR,
  sidebarHoverKey: null,
  sidebarScrollTop: 0,
  showSupportCard: true,
  showCookieSettings: false,
  crumbHome: "Home",
  crumbDataTemplates: "Data Templates",
};

const T = {
  edit: 30, // S49 starts (76.85 s)
  typeStart: 32,
  cut: 71, // S49 -> S50 (78.20 s)
  firstTypeAfterCut: 73,
  enterHold: 2, // full text shown this many frames before Enter adds it
  gap: 2, // frames between an add and the next keystroke
  hoverLead: 5, // Update Template hovered before the click
  afterClick: 24,
};

/** Caret: solid while keys arrive (and 4 frames after), blinking with a 16-frame period while idle. */
const caret = (frame: number, typingUntil: number) => frame <= typingUntil + 4 || Math.floor(frame / 16) % 2 === 0;

type OptionStep = { text: string; start: number; end: number; add: number };

/** Option typing schedule after the cut: the first option is already in the list at the cut. */
const optionSchedule = (optionCharFrames: number): { steps: OptionStep[]; click: number; end: number } => {
  const opts = USAGE_RIGHTS_FIELD.options ?? [];
  const steps: OptionStep[] = [];
  let t = T.firstTypeAfterCut;
  for (const o of opts.slice(1)) {
    const end = t + o.length * optionCharFrames;
    const add = Math.ceil(end + T.enterHold);
    steps.push({ text: o, start: t, end, add });
    t = add + T.gap;
  }
  const lastAdd = steps.length ? steps[steps.length - 1].add : T.cut;
  const click = lastAdd + 3 + T.hoverLead;
  return { steps, click, end: click + T.afterClick };
};

export const TemplatesB11Demo: React.FC<TemplatesB11DemoProps> = ({ charFrames, optionCharFrames }) => {
  const frame = useCurrentFrame();
  const d = templatesFixtures;

  if (frame < T.edit) {
    return (
      <DataTemplatesScreen
        {...shell}
        templates={d.list}
        selectedId="brand-deals"
        quickLook={d.brandDealsQuickLook}
        quickLookHover={frame >= 15 ? "edit-properties" : null}
      />
    );
  }

  // ---------------- S49: typing the property name (Status stays selected with its own 7 values)
  if (frame < T.cut) {
    const name = USAGE_RIGHTS_FIELD.name;
    const typeEnd = T.typeStart + name.length * charFrames;
    return (
      <TemplateEditPropertiesScreen
        {...shell}
        template={d.brandDealsEditor}
        selectedPropertyId="status"
        addPropertyText={name}
        addPropertyTypedChars={Math.max(0, (frame - T.typeStart) / charFrames)}
        addPropertyFocused
        addPropertyCaretVisible={caret(frame, typeEnd)}
        updateState="disabled"
        propertiesScrollTop={0}
        configureScrollTop={0}
        // she clicked "Add new property...", so the pointer is inside the (overflowing) properties column
        scrollThumb="properties"
        scrollTop={0}
      />
    );
  }

  // ---------------- S50: Usage Rights is a Dropdown with its first option; the rest are typed and added
  const { steps, click } = optionSchedule(optionCharFrames);
  let optionCount = 1;
  let optionText = "";
  let optionTyped = 0;
  let typingUntil = T.cut - 10; // idle (blinking) until the first keystroke
  for (const s of steps) {
    if (frame < s.start) break;
    typingUntil = s.end;
    if (frame < s.add) {
      optionText = s.text;
      optionTyped = (frame - s.start) / optionCharFrames;
      break;
    }
    optionCount += 1; // Enter: appended, input cleared, focus stays
  }
  const hovering = frame >= click - T.hoverLead && frame < click;
  const clicked = frame >= click;
  // her own scroll, done before the cut: the list sits at the bottom with the new row in view
  const scroll = interpolate(frame, [T.cut, T.cut + 1], [154.5, 154.5], { easing: Easing.linear });

  return (
    <TemplateEditPropertiesScreen
      {...shell}
      template={d.brandDealsEditor}
      properties={[...d.brandDealsEditor.properties, USAGE_RIGHTS_FIELD]}
      selectedPropertyId={USAGE_RIGHTS_FIELD.id}
      buildingPropertyId={USAGE_RIGHTS_FIELD.id}
      addPropertyText=""
      addPropertyFocused={false}
      optionCount={optionCount}
      optionText={optionText}
      optionTypedChars={optionTyped}
      optionFocused={!clicked && !hovering}
      optionCaretVisible={caret(frame, typingUntil)}
      updateState={clicked ? "disabled" : hovering ? "pressed" : "enabled"}
      propertiesScrollTop={scroll}
      configureScrollTop={0}
      // pointer on "Add new option..." (Configure Property); the thumb shows only if the panel overflows
      scrollThumb={hovering || clicked ? null : "configure"}
      scrollTop={0}
    />
  );
};

const DEFAULT_PROPS: TemplatesB11DemoProps = { charFrames: 3, optionCharFrames: 2 };

export const templatesB11DemoScreen: TulvoUiScreen<TemplatesB11DemoProps> = {
  id: "Templates-B11Demo",
  component: TemplatesB11Demo,
  defaultProps: DEFAULT_PROPS,
  durationInFrames: optionSchedule(DEFAULT_PROPS.optionCharFrames).end,
};
