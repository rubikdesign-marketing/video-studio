/**
 * Screen group "templates": Data Templates list (+ quick look) and the Edit properties editor,
 * wrapped in the live AppShell, plus their gallery entries (capture-match and fixtures variants).
 *
 *   TulvoUi-DataTemplates                    capture-match of day2/10-data-templates-brand-deals-panel.jpg
 *   TulvoUi-DataTemplates-Fixtures           ad data: Brand Deals after B11 (11 properties incl. Usage Rights)
 *   TulvoUi-TemplateEditProperties           capture-match of day2/09-template-edit-properties-configure.jpg
 *   TulvoUi-TemplateEditProperties-Typing    ad data: typing "Usage Rights" into "Add new property..."
 *   TulvoUi-TemplateEditProperties-Fixtures  ad data: Usage Rights added, Dropdown, 4 options, Update Template enabled
 *   TulvoUi-TemplateEditProperties-TextInput capture-match of day3-templates/01 (a text property selected)
 *   TulvoUi-TemplateEditProperties-InputTypeMenu  capture-match of day3-templates/07 (Input Type menu open)
 */
import React from "react";
import { captureMatch, MONTH3_SIDEBAR, tulvoFixtures, type SidebarData, type Workspace } from "../../fixtures";
import { AppShell } from "../../shell/AppShell";
import type { Crumb } from "../../shell/TopBar";
import type { TulvoUiScreen } from "../types";
import { brandDealsWithUsageRights, templatesCaptureMatch, templatesFixtures, USAGE_RIGHTS_FIELD } from "./data";
import { DataTemplatesList, type DataTemplatesListProps } from "./DataTemplatesList";
import { TemplateEditProperties, type TemplateEditPropertiesProps } from "./TemplateEditProperties";

/** Shell props shared by both screens. */
export type TemplatesShellProps = {
  workspace: Workspace;
  sidebar: SidebarData;
  /** Simulated sidebar hover (see SidebarProps.hoverKey), e.g. "nav:data-templates". */
  sidebarHoverKey: string | null;
  sidebarScrollTop: number;
  showSupportCard: boolean;
  /** The live site's "Cookie settings" button (on in the capture-match variants only). */
  showCookieSettings: boolean;
  /** Breadcrumb labels before the page's own crumb (verbatim: "Home", "Data Templates"). */
  crumbHome: string;
  crumbDataTemplates: string;
};

/**
 * Capture-match variants use the captured sidebar; ad variants use the Month-3 sidebar (no Day-1
 * "Workshop Interest Tracker" next to "Run It Like a Studio": seed lock SL-6, see fixtures.ts).
 */
const shellDefaults = (ds: typeof captureMatch, capture: boolean): TemplatesShellProps => ({
  workspace: ds.workspace,
  sidebar: capture ? ds.sidebar : MONTH3_SIDEBAR,
  sidebarHoverKey: null,
  sidebarScrollTop: 0,
  showSupportCard: true,
  showCookieSettings: capture,
  crumbHome: "Home",
  crumbDataTemplates: "Data Templates",
});

const Shell: React.FC<TemplatesShellProps & { crumbs: Crumb[]; children: React.ReactNode }> = (p) => (
  <AppShell
    workspace={p.workspace}
    sidebar={p.sidebar}
    activeNav="data-templates"
    sidebarHoverKey={p.sidebarHoverKey}
    sidebarScrollTop={p.sidebarScrollTop}
    showSupportCard={p.showSupportCard}
    showCookieSettings={p.showCookieSettings}
    crumbs={p.crumbs}
  >
    {p.children}
  </AppShell>
);

// ---------------------------------------------------------------- Data Templates list

export type DataTemplatesScreenProps = TemplatesShellProps & DataTemplatesListProps;

export const DataTemplatesScreen: React.FC<DataTemplatesScreenProps> = (p) => {
  const {
    workspace,
    sidebar,
    sidebarHoverKey,
    sidebarScrollTop,
    showSupportCard,
    showCookieSettings,
    crumbHome,
    crumbDataTemplates,
    ...list
  } = p;
  return (
    <Shell
      {...{ workspace, sidebar, sidebarHoverKey, sidebarScrollTop, showSupportCard, showCookieSettings, crumbHome, crumbDataTemplates }}
      crumbs={[{ label: crumbHome }, { label: crumbDataTemplates }]}
    >
      <DataTemplatesList {...list} />
    </Shell>
  );
};

const listDefaults = (capture: boolean): DataTemplatesScreenProps => {
  const d = capture ? templatesCaptureMatch : templatesFixtures;
  const after = brandDealsWithUsageRights(d);
  return {
    ...shellDefaults(capture ? captureMatch : tulvoFixtures, capture),
    templates: capture ? d.list : after.list,
    selectedId: "brand-deals",
    quickLook: capture ? d.brandDealsQuickLook : after.quickLook,
    hoverId: null,
    quickLookHover: null,
    quickLookProgress: 1,
    quickLookScrollTop: 0,
    searchText: "",
    scrollTop: 0,
  };
};

export const dataTemplatesScreen: TulvoUiScreen<DataTemplatesScreenProps> = {
  id: "DataTemplates",
  component: DataTemplatesScreen,
  defaultProps: listDefaults(true),
};

export const dataTemplatesFixturesScreen: TulvoUiScreen<DataTemplatesScreenProps> = {
  id: "DataTemplates-Fixtures",
  component: DataTemplatesScreen,
  defaultProps: listDefaults(false),
};

// ---------------------------------------------------------------- Edit properties

export type TemplateEditPropertiesScreenProps = TemplatesShellProps & TemplateEditPropertiesProps;

export const TemplateEditPropertiesScreen: React.FC<TemplateEditPropertiesScreenProps> = (p) => {
  const {
    workspace,
    sidebar,
    sidebarHoverKey,
    sidebarScrollTop,
    showSupportCard,
    showCookieSettings,
    crumbHome,
    crumbDataTemplates,
    ...editor
  } = p;
  return (
    <Shell
      {...{ workspace, sidebar, sidebarHoverKey, sidebarScrollTop, showSupportCard, showCookieSettings, crumbHome, crumbDataTemplates }}
      crumbs={[{ label: crumbHome }, { label: crumbDataTemplates }, { label: editor.template.name }]}
    >
      <TemplateEditProperties {...editor} />
    </Shell>
  );
};

/** As captured: Status selected, its 7 options, "Add new property..." focused (caret at start), nothing changed. */
const editCapture: TemplateEditPropertiesScreenProps = {
  ...shellDefaults(captureMatch, true),
  template: templatesCaptureMatch.brandDealsEditor,
  selectedPropertyId: "status",
  addPropertyText: "",
  addPropertyFocused: true,
  addPropertyCaretVisible: true,
  updateState: "disabled",
  scrollTop: 0,
  propertiesScrollTop: 0,
  configureScrollTop: 0,
  // the pointer rests over Configure Property in the capture, so the app shows its 2px thumb
  scrollThumb: "configure",
};

const fx = templatesFixtures.brandDealsEditor;

/** B11 step 1: typing "Usage Rights" (8 of 12 characters typed). */
const editTyping: TemplateEditPropertiesScreenProps = {
  ...shellDefaults(tulvoFixtures, false),
  template: fx,
  selectedPropertyId: "status",
  addPropertyText: USAGE_RIGHTS_FIELD.name,
  addPropertyTypedChars: 8,
  addPropertyFocused: true,
  addPropertyCaretVisible: true,
  updateState: "disabled",
  scrollTop: 0,
  propertiesScrollTop: 0,
  configureScrollTop: 0,
  scrollThumb: null,
};

/**
 * B11 end state: Usage Rights appended + selected, Dropdown, 4 options, Update Template enabled.
 * App behaviour (bundle, 21 Oct): a new property is appended last and selected; each added option is
 * appended and the option input is cleared (focus stays in it); Update Template is enabled while the
 * list differs from the saved one. The list does not scroll by itself: the scroll is hers.
 */
const editFixtures: TemplateEditPropertiesScreenProps = {
  ...shellDefaults(tulvoFixtures, false),
  template: fx,
  properties: [...fx.properties, USAGE_RIGHTS_FIELD],
  selectedPropertyId: USAGE_RIGHTS_FIELD.id,
  buildingPropertyId: USAGE_RIGHTS_FIELD.id,
  addPropertyText: "",
  addPropertyFocused: false,
  optionText: "",
  optionFocused: true,
  optionCaretVisible: true,
  updateState: "enabled",
  scrollTop: 0,
  propertiesScrollTop: 154.5, // bottom of the 12-row list (677.5 - 523)
  configureScrollTop: 0,
  scrollThumb: null,
};

export const templateEditPropertiesScreen: TulvoUiScreen<TemplateEditPropertiesScreenProps> = {
  id: "TemplateEditProperties",
  component: TemplateEditPropertiesScreen,
  defaultProps: editCapture,
};

export const templateEditPropertiesTypingScreen: TulvoUiScreen<TemplateEditPropertiesScreenProps> = {
  id: "TemplateEditProperties-Typing",
  component: TemplateEditPropertiesScreen,
  defaultProps: editTyping,
};

export const templateEditPropertiesFixturesScreen: TulvoUiScreen<TemplateEditPropertiesScreenProps> = {
  id: "TemplateEditProperties-Fixtures",
  component: TemplateEditPropertiesScreen,
  defaultProps: editFixtures,
};

/**
 * Capture-match of research/ui-live/day3-templates/01: a text property (Brand Name) selected, so
 * Configure Property shows "Text Input" and the Text Input Field box; the pointer rests on the row
 * (properties thumb shown). This is also what a just-added property shows (the app adds it as "text").
 */
const editTextInput: TemplateEditPropertiesScreenProps = {
  ...editCapture,
  selectedPropertyId: "brand-name",
  addPropertyFocused: false,
  scrollThumb: "properties",
};

/** Capture-match of day3-templates/07: Brand Name selected, Input Type menu open, "Text Input" checked. */
const editInputTypeMenu: TemplateEditPropertiesScreenProps = {
  ...editTextInput,
  inputTypeMenuOpen: true,
  inputTypeMenuHighlighted: "text",
  inputTypeMenuProgress: 1,
  scrollThumb: null,
};

export const templateEditPropertiesTextInputScreen: TulvoUiScreen<TemplateEditPropertiesScreenProps> = {
  id: "TemplateEditProperties-TextInput",
  component: TemplateEditPropertiesScreen,
  defaultProps: editTextInput,
};

export const templateEditPropertiesInputTypeMenuScreen: TulvoUiScreen<TemplateEditPropertiesScreenProps> = {
  id: "TemplateEditProperties-InputTypeMenu",
  component: TemplateEditPropertiesScreen,
  defaultProps: editInputTypeMenu,
};

/** The still entries of this group (index.ts adds the B11 demo). */
export const templatesStillScreens: TulvoUiScreen[] = [
  dataTemplatesScreen,
  dataTemplatesFixturesScreen,
  templateEditPropertiesScreen,
  templateEditPropertiesTypingScreen,
  templateEditPropertiesFixturesScreen,
  templateEditPropertiesTextInputScreen,
  templateEditPropertiesInputTypeMenuScreen,
];
