/**
 * Edit properties page of a data template (route /data-templates/<id>):
 * title + edit button, Group / Used in / Status / Created by, the properties editor
 * ("Add new property...", property rows with type chips, Configure Property panel with Input Type,
 * "<n> Values Single" switch, "Add new option...", options list), the Update Template footer, and
 * below the fold the API keys / Incoming webhooks / Boards sections.
 *
 * Rebuilt from research/ui-live/dom/template-edit-properties.html, screenshot
 * research/ui-live/day2/09-template-edit-properties-configure.jpg. Class strings verbatim.
 *
 * Pure and frame-agnostic. Everything that moves is a prop: typed characters + caret in both inputs,
 * the selected property, how many options are listed, three scroll positions, the Update Template
 * state (disabled -> enabled -> pressed).
 */
import React from "react";
import { Check, ChevronDown, GripVertical, KeyRound, Paperclip, PencilLine, Plus, Settings, Sparkles, Webhook, X } from "lucide-react";
import { TablerFileText } from "../../icons/app-icons";
import type { TemplateBoardRow, TemplateEditorData, TemplateField } from "./data";
import { TypedInput, typedText } from "./parts";

// ---------------------------------------------------------------- labels (verbatim)

export const TEMPLATE_EDITOR_LABELS = {
  editTemplate: "Edit data template",
  group: "Group:",
  usedIn: "Used in:",
  status: "Status:",
  createdBy: "Created by:",
  tulvoAi: "Tulvo AI",
  properties: "Properties",
  addProperty: "Add new property...",
  fixedPosition: "Fixed position",
  dragToReorder: "Drag to reorder",
  removeGroup: "Remove group",
  configureProperty: "Configure Property",
  inputType: "Input Type",
  /**
   * "<n> Values Single" (n = number of options). The app renders [n, " ", " Values Single"], so
   * "0 Values Single" and "1 Values Single" are correct as is (no singular form; app bundle, 21 Oct).
   */
  valuesSingle: "Values Single",
  /** Switch ON (multiple values). From the app bundle; the ON state was never captured on screen. */
  valuesMultiple: "Values Multiple",
  dropdownOptions: "Dropdown Options",
  // Configure Property for the other input types (research/ui-live/day3-templates, 21 Oct 2026)
  textInputField: "Text Input Field",
  textInputHelp: "This field will show a text input where users can enter any text they want.",
  enterTextPlaceholder: "Enter text...",
  enterText: "+ Enter Text",
  numberInputField: "Number Input Field",
  numberInputHelp: "This field will show a number input where users can enter numeric values.",
  datePicker: "Date Picker",
  dateInputField: "Date Input Field",
  dateInputHelp: "This field will show a date picker for date selection.",
  contributors: "Contributors",
  userAssignmentField: "User Assignment Field",
  userAssignmentHelp: "This field will allow users to assign team members or contributors.",
  sampleUserInitial: "U",
  sampleUser: "Sample User Assignment",
  assignContributors: "+ Assign Contributors",
  attachmentField: "Attachment Field",
  attachmentHelp:
    "This field allows users to upload and manage file attachments. Files are stored securely and can be accessed from the task.",
  maxFileSize: "Maximum File Size",
  maxFileSizeValue: "5 MB",
  allowedFileTypes: "Allowed File Types",
  fileTypes: ["Images", "PDF", "Documents", "Spreadsheets", "Videos", "Archives"],
  viewAllFormats: "View all supported formats",
  attachmentPreview: "Preview",
  exampleFile: "example-document.pdf",
  uploadFiles: "+ Upload Files",
  addOption: "Add new option...",
  valueColor: "Value color",
  removeOption: "Remove option",
  updateTemplate: "Update Template",
  apiKeys: "API keys",
  addApiKey: "Add API Key",
  noApiKeys: "No API keys for this template.",
  webhooks: "Incoming webhooks",
  addWebhook: "Add Webhook",
  noWebhooks: "No webhooks for this template.",
  boards: "Boards",
  colName: "Name",
  colTabs: "Tabs",
  colLastUpdated: "Last Updated",
};
export type TemplateEditorLabels = typeof TEMPLATE_EDITOR_LABELS;

/**
 * Input Type trigger text per property type, verbatim. Captured live for all six types on 21 Oct 2026
 * (research/ui-live/day3-templates/01-06) and identical to the app's own label map.
 */
export const INPUT_TYPE_LABEL: Record<TemplateField["type"], string> = {
  dropdown: "Dropdown",
  text: "Text Input",
  number: "Number Input",
  date: "Date Picker",
  attachment: "Attachment",
  contributors: "Contributors",
};

/** The Input Type menu, in the app's order (day3-templates/07). Values are the app's field types. */
export const INPUT_TYPE_MENU_ITEMS: { value: string; label: string }[] = [
  { value: "dropdown", label: "Dropdown" },
  { value: "text", label: "Text Input" },
  { value: "number", label: "Number Input" },
  { value: "date", label: "Date Picker" },
  { value: "contributors", label: "Contributors" },
  { value: "calculation", label: "Math Calculation" },
  { value: "relation", label: "Task Relation" },
  { value: "attachment", label: "Attachment" },
  { value: "json", label: "JSON" },
];

// ---------------------------------------------------------------- class strings (verbatim)

const BTN =
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";
const EDIT_BTN = `${BTN} border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground ml-auto h-8 w-8 shrink-0`;
const BADGE =
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80";
const SCROLL_COL =
  "overflow-y-auto overflow-x-hidden !scrollbar !scrollbar-w-0.5 scrollbar-track-transparent scrollbar-thumb-transparent hover:scrollbar-thumb-gray-400/50 dark:scrollbar-thumb-transparent dark:hover:scrollbar-thumb-gray-400/50 min-h-0";
const INPUT_BASE =
  "flex border border-input dark:bg-input/30 bg-transparent px-3 py-1 text-base shadow-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary dark:focus-visible:ring-0 dark:focus-visible:border-[#3d3d3d] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";
const ADD_PROPERTY_INPUT = `${INPUT_BASE} filter-group-input w-full h-8 rounded-[10px]`;
const ADD_OPTION_INPUT = `flex w-full ${INPUT_BASE.slice("flex ".length)} filter-group-input flex-1 h-8 rounded-[10px]`;
const ADD_BTN_BASE = `${BTN} hover:bg-accent hover:text-accent-foreground w-9`;
const ADD_PROPERTY_BTN = `${ADD_BTN_BASE} filter-group- absolute right-[1px] top-1/2 transform -translate-y-1/2 h-7`;
const ADD_OPTION_BTN = `${ADD_BTN_BASE} filter-group-add-btn absolute right-[1px] top-1/2 transform -translate-y-1/2 h-7`;
const ROW = "filter-group-list flex flex-col gap-2 min-h-10 px-2 py-2 rounded-xl border bg-card transition-all cursor-pointer";
const PROP_ROW = `${ROW} border-border`;
const PROP_ROW_SELECTED = `${ROW} active border-border bg-property-item-selected`;
const OPTION_ROW = "filter-group-list flex flex-col gap-2 min-h-10 px-2 py-2 rounded-xl border border-border bg-card";
const GRIP = "shrink-0 p-1 rounded cursor-grab active:cursor-grabbing hover:bg-gray-100 dark:hover:bg-gray-700";
const OPTION_GRIP = "p-1 rounded shrink-0 cursor-grab active:cursor-grabbing hover:bg-gray-100 dark:hover:bg-gray-600";
const ICON_BTN =
  "inline-flex items-center gap-1 whitespace-nowrap font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground text-xs rounded-full justify-center w-5 h-5 shrink-0 p-0";
const TYPE_CHIP = "text-xs font-normal text-muted-foreground bg-background border border-border px-2.5 py-0.5 rounded-full shrink-0";
const REMOVE_BTN = "p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded shrink-0";
const SELECT_TRIGGER =
  "flex items-center justify-between whitespace-nowrap border border-input bg-transparent px-2 py-1 font-medium shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring dark:focus:ring-0 dark:focus:border-[#3d3d3d] disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 filter-configure-trigger w-full h-8 rounded-[10px] text-sm text-primary/80";
// Input Type menu (Radix Select content, day3-templates/07, 08)
const MENU_CONTENT =
  "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1 filter-configure-content";
const MENU_VIEWPORT = "p-1 h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]";
const MENU_ITEM =
  "relative flex w-full cursor-default select-none items-center gap-2 rounded-lg py-1.5 px-2 outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[state=checked]:bg-accent data-[state=checked]:text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50 filter-configure-select-item text-sm text-primary/80";
// Configure Property boxes for the non-dropdown types (day3-templates/dom-excerpts.txt)
const FIELD_BOX = "space-y-4 p-4 rounded-lg bg-[#F5F5F5] dark:bg-[#262626]";
const FIELD_BOX_TITLE = "text-xs text-[#0A0A0A] dark:text-[#FAFAFA]";
const FIELD_BOX_HELP = "text-xs text-[#737373] dark:text-[#A3A3A3]";
const FIELD_BOX_LABEL = "block text-sm font-normal text-gray-700 dark:text-gray-300";
const FIELD_PREVIEW_INPUT =
  "w-full h-8 px-3 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all";
const FIELD_DASHED_BTN =
  "w-full h-8 px-3 flex items-center justify-center border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors";
const UPDATE_BTN =
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none px-4 h-8 py-1.5";
const SECTION_BTN = "group flex min-w-0 items-center gap-2 rounded text-left [&[data-state=closed]>svg]:-rotate-90";
const SECTION_ACTION =
  "inline-flex items-center justify-center gap-1 whitespace-nowrap font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-8";
const EMPTY_BOX = "flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card/40 px-6 py-10 text-center";
const TH = "h-10 px-2 text-left align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] py-4 text-t-muted-bg font-normal whitespace-nowrap";
const TH_RIGHT =
  "h-10 px-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-right py-4 text-t-muted-bg font-normal whitespace-nowrap";
const TD = "p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-2 align-middle py-3";

const ROW_STYLE: React.CSSProperties = { opacity: 1 };
const scrollStyle = (y: number): React.CSSProperties | undefined => (y ? { transform: `translateY(${-y}px)` } : undefined);

// ---------------------------------------------------------------- rows

const Grip: React.FC = () => <GripVertical className="w-4 h-4 text-muted-foreground" />;

export type PropertyRowProps = { field: TemplateField; selected?: boolean; labels?: Partial<TemplateEditorLabels> };

/** One property in the editor list (type chip shows the lowercase type id, as the DOM does). */
export const PropertyRow: React.FC<PropertyRowProps> = ({ field, selected = false, labels }) => {
  const L = { ...TEMPLATE_EDITOR_LABELS, ...labels };
  if (field.fixed) {
    return (
      <div className={PROP_ROW} style={ROW_STYLE}>
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="shrink-0 p-1 rounded cursor-default opacity-40" title={L.fixedPosition}>
              <Grip />
            </div>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-sm font-normal text-foreground truncate min-w-0 flex-1" title={field.name}>
                {field.name}
              </span>
              <span className={TYPE_CHIP}>{field.type}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={selected ? PROP_ROW_SELECTED : PROP_ROW} style={ROW_STYLE}>
      <div className="flex items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div role="button" tabIndex={0} aria-roledescription="sortable" className={GRIP} title={L.dragToReorder}>
            <Grip />
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="shrink-0">
              <button className={ICON_BTN} role="combobox" aria-expanded="false" aria-label="Icon" title="Icon" type="button" data-state="closed">
                <div className="flex items-center justify-center">
                  <TablerFileText className="tabler-icon tabler-icon-file-text !w-4 !h-4 text-muted-foreground" />
                </div>
              </button>
            </div>
            <span className="text-sm font-normal text-foreground truncate min-w-0 flex-1" title={field.name}>
              {field.name}
            </span>
            <span className={TYPE_CHIP}>{field.type}</span>
          </div>
        </div>
        <button className={REMOVE_BTN} title={L.removeGroup}>
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const OptionRow: React.FC<{ label: string; labels?: Partial<TemplateEditorLabels> }> = ({ label, labels }) => {
  const L = { ...TEMPLATE_EDITOR_LABELS, ...labels };
  return (
    <div className={OPTION_ROW} style={ROW_STYLE}>
      <div className="flex items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div role="button" tabIndex={0} aria-roledescription="sortable" className={OPTION_GRIP} title={L.dragToReorder}>
            <Grip />
          </div>
          <button
            type="button"
            title={L.valueColor}
            className="w-4 h-4 rounded-full shrink-0 transition-colors disabled:opacity-40 border-[1px] border-dashed border-muted-foreground/80 bg-transparent hover:border-primary/60 hover:bg-muted"
            aria-haspopup="dialog"
            aria-expanded="false"
            data-state="closed"
          />
          <div className="flex-1 min-w-0 cursor-pointer">
            <span className="text-sm text-foreground flex items-center gap-1.5">{label}</span>
          </div>
        </div>
        <button className={REMOVE_BTN} title={L.removeOption}>
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- configure panel

/** The body under "Input Type" for the non-dropdown types (captured 21 Oct 2026, day3-templates). */
const FieldTypePanel: React.FC<{ type: TemplateField["type"]; L: TemplateEditorLabels }> = ({ type, L }) => {
  if (type === "text") {
    return (
      <div>
        <div className={FIELD_BOX}>
          <div className="flex items-center gap-2">
            <span className={FIELD_BOX_TITLE}>{L.textInputField}</span>
          </div>
          <p className={FIELD_BOX_HELP}>{L.textInputHelp}</p>
          <div className="space-y-2">
            <input placeholder={L.enterTextPlaceholder} className={FIELD_PREVIEW_INPUT} disabled type="text" readOnly value="" />
            <button className={FIELD_DASHED_BTN} disabled>
              {L.enterText}
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (type === "number") {
    return (
      <div>
        <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="text-sm font-normal text-primary/80">{L.numberInputField}</span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">{L.numberInputHelp}</p>
        </div>
      </div>
    );
  }
  if (type === "date") {
    return (
      <div>
        <div className="space-y-3">
          <label className={FIELD_BOX_LABEL}>{L.datePicker}</label>
          <div className={FIELD_BOX}>
            <div className="flex items-center gap-2">
              <span className={FIELD_BOX_TITLE}>{L.dateInputField}</span>
            </div>
            <p className={FIELD_BOX_HELP}>{L.dateInputHelp}</p>
            <input className={FIELD_PREVIEW_INPUT} disabled type="date" readOnly value="" />
          </div>
        </div>
      </div>
    );
  }
  if (type === "contributors") {
    return (
      <div>
        <div className="space-y-3">
          <label className={FIELD_BOX_LABEL}>{L.contributors}</label>
          <div className={FIELD_BOX}>
            <div className="flex items-center gap-2">
              <span className={FIELD_BOX_TITLE}>{L.userAssignmentField}</span>
            </div>
            <p className={FIELD_BOX_HELP}>{L.userAssignmentHelp}</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 h-8 px-3 bg-background rounded-lg border border-border">
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-primary text-xs font-normal">
                  {L.sampleUserInitial}
                </div>
                <span className="text-sm text-foreground">{L.sampleUser}</span>
              </div>
              <button className={FIELD_DASHED_BTN} disabled>
                {L.assignContributors}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (type === "attachment") {
    return (
      <div>
        <div className={FIELD_BOX}>
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-primary/80" />
            <span className={FIELD_BOX_TITLE}>{L.attachmentField}</span>
          </div>
          <p className={FIELD_BOX_HELP}>{L.attachmentHelp}</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-normal text-primary/80">{L.maxFileSize}</span>
              <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">{L.maxFileSizeValue}</span>
            </div>
          </div>
          <div className="space-y-2">
            <span className="text-sm font-normal text-primary/80">{L.allowedFileTypes}</span>
            <div className="flex flex-wrap gap-2">
              {L.fileTypes.map((t) => (
                <span key={t} className="px-2 py-1 text-xs bg-background border border-border rounded-4xl text-foreground">
                  {t}
                </span>
              ))}
            </div>
            {/* <details> closed as captured; the format grid inside it is not rendered */}
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">{L.viewAllFormats}</summary>
            </details>
          </div>
          <div className="space-y-2 pt-2 border-t border-border">
            <span className="text-sm font-normal text-primary/80">{L.attachmentPreview}</span>
            <div className="space-y-1">
              <div className="flex items-center gap-2 h-8 px-3 bg-background border border-border rounded-lg text-xs">
                <Paperclip className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground truncate flex-1">{L.exampleFile}</span>
              </div>
              <button className={`${FIELD_DASHED_BTN} text-xs`} disabled>
                {L.uploadFiles}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export type InputTypeMenuProps = {
  /** Checked item (the property's current type, e.g. "text"). */
  value: string;
  /** Item under the pointer / keyboard focus (data-highlighted). Radix highlights the checked item on open. */
  highlightedValue?: string | null;
  /** Open animation 0..1 (the app: animate-in fade-in-0 zoom-in-95 slide-in-from-top-2, 150 ms). */
  progress?: number;
  /** Width of the trigger (px): the listbox is the trigger width + its 2px border. */
  triggerWidth: number;
  items?: { value: string; label: string }[];
};

/**
 * The open Input Type select (Radix Select content), captured live on 21 Oct 2026
 * (day3-templates/07 open, 08 pointer over "Dropdown"). Render it inside a positioned box whose
 * top-left is the trigger's bottom-left (TemplateEditProperties does this for you).
 */
export const InputTypeMenu: React.FC<InputTypeMenuProps> = ({
  value,
  highlightedValue,
  progress = 1,
  triggerWidth,
  items = INPUT_TYPE_MENU_ITEMS,
}) => {
  const p = Math.max(0, Math.min(1, progress));
  const highlighted = highlightedValue === undefined ? value : highlightedValue;
  // tailwindcss-animate "enter": from opacity 0, translateY(-0.5rem), scale(.95) to the element's own
  // transform (data-[side=bottom]:translate-y-1); transform origin = the popper's "0% 0px".
  const motion: React.CSSProperties | undefined =
    p < 1
      ? { opacity: p, transform: `translateY(${4 - 12 * (1 - p)}px) scale(${0.95 + 0.05 * p})`, transformOrigin: "0% 0px" }
      : undefined;
  return (
    <div
      data-side="bottom"
      data-align="start"
      role="listbox"
      data-state="open"
      tabIndex={-1}
      className={MENU_CONTENT}
      style={
        {
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          outline: "none",
          pointerEvents: "auto",
          "--radix-select-trigger-width": `${triggerWidth}px`,
          "--radix-select-trigger-height": "32px",
          ...motion,
        } as React.CSSProperties
      }
    >
      <div role="presentation" className={MENU_VIEWPORT} style={{ position: "relative", flex: "1 1 0%", overflow: "hidden auto" }}>
        {items.map((it) => {
          const checked = it.value === value;
          return (
            <div
              key={it.value}
              role="option"
              aria-selected={checked}
              data-state={checked ? "checked" : "unchecked"}
              data-highlighted={it.value === highlighted ? "" : undefined}
              tabIndex={-1}
              className={MENU_ITEM}
            >
              <span>{it.label}</span>
              <span className="ml-auto flex h-4 w-4 items-center justify-center">
                {checked ? (
                  <span aria-hidden="true">
                    <Check className="h-4 w-4" />
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export type ConfigurePropertyProps = {
  /** The selected property (its type drives the Input Type text and the body below it). */
  field: TemplateField | null;
  /** Input Type trigger text. Default: from field.type. */
  inputTypeLabel?: string;
  /** Input Type trigger focus ring (focus returns to the trigger after the menu closes). */
  inputTypeFocused?: boolean;
  /** The Input Type menu is open: trigger data-state="open", no ring (focus is in the listbox). */
  inputTypeMenuOpen?: boolean;
  /** Options listed. Default: field.options. */
  options?: string[];
  /** Show only the first n options (grow the list item by item). Default: all. */
  optionCount?: number;
  /** "Add new option..." field: full text, typed characters (animate), focus + caret. */
  optionText?: string;
  optionTypedChars?: number;
  optionFocused?: boolean;
  optionCaretVisible?: boolean;
  /** Vertical scroll of the panel (px). */
  scrollTop?: number;
  labels?: Partial<TemplateEditorLabels>;
};

export const ConfigureProperty: React.FC<ConfigurePropertyProps> = ({
  field,
  inputTypeLabel,
  inputTypeFocused = false,
  inputTypeMenuOpen = false,
  options,
  optionCount,
  optionText = "",
  optionTypedChars,
  optionFocused = false,
  optionCaretVisible = true,
  scrollTop = 0,
  labels,
}) => {
  const L = { ...TEMPLATE_EDITOR_LABELS, ...labels };
  // The app falls back to "dropdown" for a property without a fieldType.
  const type = field?.type ?? "dropdown";
  const allOptions = options ?? field?.options ?? [];
  const shownOptions = optionCount === undefined ? allOptions : allOptions.slice(0, Math.max(0, Math.floor(optionCount)));
  const typedOption = typedText(optionText, optionTypedChars);
  const ring = inputTypeFocused && !inputTypeMenuOpen;
  return (
    <div style={scrollStyle(scrollTop)}>
      <div className="overflow-hidden">
        <div>
          <div className="template-ai-header-wrapper p-4 flex-shrink-0">
            <div className="template-ai-header flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-normal text-foreground">{L.configureProperty}</h2>
            </div>
          </div>
          <div className="space-y-6 p-4">
            <div>
              <label className="filter-configure-input-label block text-sm font-normal text-muted-foreground mb-2">{L.inputType}</label>
              <button
                type="button"
                role="combobox"
                aria-expanded={inputTypeMenuOpen}
                data-state={inputTypeMenuOpen ? "open" : "closed"}
                className={SELECT_TRIGGER}
                style={ring ? { boxShadow: "0 0 0 1px hsl(var(--ring)), 0 1px 2px 0 rgb(0 0 0 / 0.05)" } : undefined}
              >
                <span style={{ pointerEvents: "none" }}>{inputTypeLabel ?? INPUT_TYPE_LABEL[type]}</span>
                <ChevronDown className="h-4 w-4 opacity-50 ml-1" aria-hidden="true" />
              </button>
            </div>
            {type === "dropdown" ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="switch-label text-sm text-muted-foreground">
                      {shownOptions.length} {L.valuesSingle}
                    </span>
                    <button className="switch-btn relative inline-flex h-[18px] w-8 items-center rounded-full transition-colors bg-input">
                      <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform translate-x-0.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="dropdown-options-label block text-sm font-normal text-muted-foreground mb-3">{L.dropdownOptions}</label>
                  <div className="flex items-center gap-2 relative mb-4">
                    <TypedInput
                      className={ADD_OPTION_INPUT}
                      placeholder={L.addOption}
                      value={optionText}
                      typedChars={optionTypedChars}
                      focused={optionFocused}
                      caretVisible={optionCaretVisible}
                    />
                    <button className={ADD_OPTION_BTN} disabled={typedOption.trim().length === 0}>
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {shownOptions.map((o, i) => (
                      <OptionRow key={`${i}-${o}`} label={o} labels={labels} />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <FieldTypePanel type={type} L={L} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- below-the-fold sections

const CollapsibleHeader: React.FC<{ title: string; count: number; action?: React.ReactNode }> = ({ title, count, action }) => (
  <div className="flex min-h-8 items-center gap-2">
    <button type="button" className={SECTION_BTN} aria-expanded="true" data-state="open">
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
      <h2 className="truncate text-base font-medium">{title}</h2>
      <div className={`${BADGE} font-normal tabular-nums`}>{count}</div>
    </button>
    {action ? <div className="ml-auto flex shrink-0 items-center gap-2">{action}</div> : null}
  </div>
);

const EmptyState: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
  <div className="pt-3">
    <div>
      <div className={EMPTY_BOX}>
        {icon}
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  </div>
);

const BoardsTable: React.FC<{ rows: TemplateBoardRow[]; labels: TemplateEditorLabels }> = ({ rows, labels: L }) => (
  <div className="pt-3">
    <div className="relative w-full overflow-x-auto !scrollbar !scrollbar-h-0.5 scrollbar-track-transparent scrollbar-thumb-transparent hover:scrollbar-thumb-gray-400/50 dark:scrollbar-thumb-transparent dark:hover:scrollbar-thumb-gray-400/50">
      <table className="w-full caption-bottom text-sm">
        <thead className="[&_tr]:border-b bg-t-header-bg border-t">
          <tr className="border-b transition-colors data-[state=selected]:bg-muted h-12 hover:bg-transparent">
            <th className={TH}>{L.colName}</th>
            <th className={TH}>{L.colTabs}</th>
            <th className={TH_RIGHT}>{L.colLastUpdated}</th>
          </tr>
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {rows.map((r) => (
            <tr key={r.name} className="transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted border-b border-border">
              <td className={`${TD} font-medium`}>
                <a className="hover:underline">{r.name}</a>
              </td>
              <td className={`${TD} text-muted-foreground`}>{r.tabs.join(", ")}</td>
              <td className={`${TD} text-right text-muted-foreground`}>{r.lastUpdated}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ---------------------------------------------------------------- column geometry

export type EditorColumn = "properties" | "configure";

/**
 * Editor layout constants in CSS px, measured on the rebuilt stills and matched to day2/09 (rows
 * align with the capture to 0.25 px; 7 options overflow the Configure panel and the captured
 * thumb spans ~425 of 521 px).
 */
export const EDITOR_GEOMETRY = {
  /** h-[600px] minus the footer (pt-6 + h-8 + 1px border-t) minus the columns' mb-5. */
  columnHeight: 523,
  /** Option row (py-2 + 24 + 2px border = 42) + space-y-2 gap. */
  rowPitch: 50,
  /** Property rows: the fixed title row is 42 tall, the others 42.5 (inline-flex icon button line box). */
  fixedRowHeight: 42,
  propertyRowHeight: 42.5,
  /** Width of the app's scrollbar (!scrollbar-w-0.5). */
  scrollbar: 2,
};

/**
 * Height of the properties column content: "Properties" (20) + mb-3 (12, collapses with the
 * input's mt-2) + input (32) + mt-4 (16) + rows with 8px gaps.
 */
export const propertiesContentHeight = (rows: TemplateField[]) =>
  80 +
  rows.reduce((h, r) => h + (r.fixed ? EDITOR_GEOMETRY.fixedRowHeight : EDITOR_GEOMETRY.propertyRowHeight), 0) +
  Math.max(0, rows.length - 1) * 8;

/** Top of row i in the properties column content (px), e.g. to place an overlay on a new row. */
export const propertyRowTop = (rows: TemplateField[], i: number) =>
  80 + rows.slice(0, i).reduce((h, r) => h + (r.fixed ? EDITOR_GEOMETRY.fixedRowHeight : EDITOR_GEOMETRY.propertyRowHeight) + 8, 0);

/**
 * Height of the body under Input Type for the non-dropdown types (CSS px, measured live on
 * 21 Oct 2026; attachment from the class strings, its panel overflows the column).
 */
export const FIELD_TYPE_BODY_HEIGHT: Record<Exclude<TemplateField["type"], "dropdown">, number> = {
  text: 184,
  number: 110,
  date: 160,
  contributors: 200,
  attachment: 382,
};

/**
 * Height of the Configure Property content. `options` = option count for a dropdown, null for another
 * type (pass `type` to include that type's body).
 */
export const configureContentHeight = (options: number | null, type?: TemplateField["type"]) => {
  const head = 52 + 16 + 60; // header (p-4 + 20) + body padding + Input Type block
  if (options === null) return head + (type && type !== "dropdown" ? 24 + FIELD_TYPE_BODY_HEIGHT[type] : 0) + 16;
  return head + 24 + 20 + 24 + 20 + 12 + 32 + 16 + (options > 0 ? options * EDITOR_GEOMETRY.rowPitch - 8 : 0) + 16;
};

/** Input Type trigger box inside the Configure Property column's padding box (scroll 0). */
export const INPUT_TYPE_TRIGGER = { left: 16, top: 96, height: 32 };

type ColumnMetrics = { column: EditorColumn; overflows: boolean; scrollTop: number; thumbTop: number; thumbHeight: number };

const columnMetrics = (column: EditorColumn, content: number, scrollTop: number): ColumnMetrics => {
  const viewport = EDITOR_GEOMETRY.columnHeight - (column === "configure" ? 2 : 0); // configure has a 1px border
  const max = Math.max(0, content - viewport);
  const y = Math.max(0, Math.min(max, scrollTop));
  return {
    column,
    overflows: content > viewport,
    scrollTop: y,
    thumbTop: content > 0 ? (y * viewport) / content : 0,
    thumbHeight: content > 0 ? (viewport * viewport) / content : 0,
  };
};

// ---------------------------------------------------------------- page content

export type UpdateTemplateState = "disabled" | "enabled" | "pressed";

export type TemplateEditPropertiesProps = {
  template: TemplateEditorData;
  /** Selected property id (row tinted; Configure Property shows it). */
  selectedPropertyId: string | null;
  /** Rows listed (default: template.properties). Append a field here to "add" it. */
  properties?: TemplateField[];

  /** "Add new property..." field: full text, typed characters (animate), focus + caret. */
  addPropertyText?: string;
  addPropertyTypedChars?: number;
  addPropertyFocused?: boolean;
  addPropertyCaretVisible?: boolean;

  /**
   * The property being built in this shot (e.g. "usage-rights"). The overrides below (inputTypeLabel,
   * options, optionCount, optionText, optionTypedChars, optionFocused, optionCaretVisible) apply ONLY
   * while this property is the selected one; any other selected property shows its own data
   * (Status keeps its 7 values). Omit it and the overrides are ignored.
   */
  buildingPropertyId?: string | null;
  /** Configure Property overrides for the property being built (see ConfigurePropertyProps). */
  inputTypeLabel?: string;
  options?: string[];
  optionCount?: number;
  optionText?: string;
  optionTypedChars?: number;
  optionFocused?: boolean;
  optionCaretVisible?: boolean;

  /** Input Type trigger focus ring (focus returns to the trigger after the menu closes). Any property. */
  inputTypeFocused?: boolean;
  /** Input Type menu open (any property). Items, checked item and look as captured (day3-templates/07). */
  inputTypeMenuOpen?: boolean;
  /** Highlighted menu item; default = the checked one (Radix highlights it on open). */
  inputTypeMenuHighlighted?: string | null;
  /** Menu open animation 0..1 (150 ms in the app, CSS ease). */
  inputTypeMenuProgress?: number;

  /**
   * Update Template button. "disabled": no unsaved changes (as captured). "enabled": the app enables it
   * as soon as the property list differs from the saved one (an added property, a type change, an
   * option). "pressed": the pointer is over it (hover:bg-primary/90). After the click the app disables
   * it while saving and keeps it disabled once saved (nothing left to save): pass "disabled" again.
   * The app also shows a "Template updated successfully" toast; its look was not captured, so it is
   * not rebuilt.
   */
  updateState?: UpdateTemplateState;

  /**
   * Scroll positions (px): whole page, properties column, Configure Property panel. The two
   * column scrolls are clamped to their content (pass a large number to reach the bottom).
   */
  scrollTop?: number;
  propertiesScrollTop?: number;
  configureScrollTop?: number;
  /**
   * The pointer is over this column: the app then paints its 2px scrollbar thumb
   * (hover:scrollbar-thumb-gray-400/50) if the column overflows. Geometry is computed.
   */
  scrollThumb?: EditorColumn | null;

  labels?: Partial<TemplateEditorLabels>;
};

export const TemplateEditProperties: React.FC<TemplateEditPropertiesProps> = ({
  template,
  selectedPropertyId,
  properties,
  addPropertyText = "",
  addPropertyTypedChars,
  addPropertyFocused = false,
  addPropertyCaretVisible = true,
  buildingPropertyId = null,
  inputTypeLabel,
  inputTypeFocused,
  inputTypeMenuOpen = false,
  inputTypeMenuHighlighted,
  inputTypeMenuProgress = 1,
  options,
  optionCount,
  optionText,
  optionTypedChars,
  optionFocused,
  optionCaretVisible,
  updateState = "disabled",
  scrollTop = 0,
  propertiesScrollTop = 0,
  configureScrollTop = 0,
  scrollThumb = null,
  labels,
}) => {
  const L = { ...TEMPLATE_EDITOR_LABELS, ...labels };
  const rows = properties ?? template.properties;
  const selected = rows.find((r) => r.id === selectedPropertyId) ?? null;
  const typedProperty = typedText(addPropertyText, addPropertyTypedChars);
  // Overrides only reach the property being built; every other property shows its own data.
  const building = buildingPropertyId !== null && selected !== null && selected.id === buildingPropertyId;
  const b = building
    ? { inputTypeLabel, options, optionCount, optionText, optionTypedChars, optionFocused, optionCaretVisible }
    : {};

  // Both columns are scroll containers with a 2px scrollbar (!scrollbar-w-0.5). A render has no
  // scrollbars, so reserve its width when the column overflows (as the browser does) and paint
  // the thumb when the pointer is over the column.
  const shownOptionCount = (() => {
    const all = b.options ?? selected?.options ?? [];
    return b.optionCount === undefined ? all.length : Math.max(0, Math.min(all.length, Math.floor(b.optionCount)));
  })();
  const propCol = columnMetrics("properties", propertiesContentHeight(rows), propertiesScrollTop);
  const conf = columnMetrics(
    "configure",
    configureContentHeight(selected?.type === "dropdown" ? shownOptionCount : null, selected?.type),
    configureScrollTop,
  );
  // Input Type trigger width: column inner width (474.5 - 2 border) - p-4 x2 - the 2px scrollbar when it overflows.
  const triggerWidth = 440.5 - (conf.overflows ? EDITOR_GEOMETRY.scrollbar : 0);
  const thumb = (m: ColumnMetrics) =>
    scrollThumb === m.column && m.overflows ? (
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          right: 0,
          top: m.thumbTop,
          width: EDITOR_GEOMETRY.scrollbar,
          height: m.thumbHeight,
          background: "rgb(156 163 175 / 0.5)",
          pointerEvents: "none",
        }}
      />
    ) : null;

  return (
    <div className="min-h-0 w-full flex-1 overflow-y-auto bg-background">
      <div className="w-full px-4 lg:px-[3.375rem] flex flex-col gap-2 py-6 lg:py-8" style={scrollStyle(scrollTop)}>
        <div className="flex min-h-8 items-center gap-2">
          <h1 className="truncate text-lg font-medium">{template.name}</h1>
          <button className={EDIT_BTN} aria-label={L.editTemplate}>
            <PencilLine className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-col gap-[50px] pb-[100px]">
          <section className="flex flex-col gap-3">
            <dl className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <div className="flex min-h-6 items-center gap-1.5">
                <dt className="text-muted-foreground">{L.group}</dt>
                <dd className="flex items-center">{template.group}</dd>
              </div>
              <div className="flex min-h-6 items-center gap-1.5">
                <dt className="text-muted-foreground">{L.usedIn}</dt>
                <dd className="flex items-center">
                  <div className="flex min-w-0 flex-wrap items-center gap-1">
                    {template.usedIn.map((u) => (
                      <div key={u} className={`${BADGE} whitespace-nowrap font-normal`}>
                        {u}
                      </div>
                    ))}
                  </div>
                </dd>
              </div>
              <div className="flex min-h-6 items-center gap-1.5">
                <dt className="text-muted-foreground">{L.status}</dt>
                <dd className="flex items-center">{template.status}</dd>
              </div>
              <div className="flex min-h-6 items-center gap-1.5">
                <dt className="text-muted-foreground">{L.createdBy}</dt>
                <dd className="flex items-center">
                  <span className="relative flex shrink-0 overflow-hidden rounded-full h-7 w-7 border" data-state="closed">
                    <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground" aria-label={L.tulvoAi}>
                      <Sparkles strokeWidth={1.5} className="h-3.5 w-3.5" />
                    </div>
                  </span>
                </dd>
              </div>
            </dl>
            <div className="h-[600px]">
              <div className="flex h-full flex-col">
                <div className="flex flex-1 min-h-0 flex-col">
                  <div className="flex flex-1 min-h-0 flex-col lg:flex-row lg:gap-5">
                    <div
                      className={`w-full lg:w-[58.23%] mb-5 pr-1 ${SCROLL_COL}`}
                      style={{ position: "relative", paddingRight: propCol.overflows ? 4 + EDITOR_GEOMETRY.scrollbar : undefined }}
                    >
                      <div style={scrollStyle(propCol.scrollTop)}>
                        <div className="mb-0">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <h3 className="filter-group-title text-sm font-normal text-muted-foreground">{L.properties}</h3>
                          </div>
                          <div className="mt-2 px-1">
                            <div className="relative">
                              <TypedInput
                                className={ADD_PROPERTY_INPUT}
                                placeholder={L.addProperty}
                                value={addPropertyText}
                                typedChars={addPropertyTypedChars}
                                focused={addPropertyFocused}
                                caretVisible={addPropertyCaretVisible}
                              />
                              <button className={ADD_PROPERTY_BTN} disabled={typedProperty.trim().length === 0}>
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-2 mt-4">
                            {rows.map((f) => (
                              <PropertyRow key={f.id} field={f} selected={f.id === selectedPropertyId} labels={labels} />
                            ))}
                          </div>
                        </div>
                      </div>
                      {thumb(propCol)}
                    </div>
                    <div
                      className={`w-full lg:w-[41.77%] mb-5 rounded-lg border border-border bg-settings-sidebar ${SCROLL_COL}`}
                      style={{ position: "relative", paddingRight: conf.overflows ? EDITOR_GEOMETRY.scrollbar : undefined }}
                    >
                      <ConfigureProperty
                        field={selected}
                        inputTypeLabel={b.inputTypeLabel}
                        inputTypeFocused={inputTypeFocused}
                        inputTypeMenuOpen={inputTypeMenuOpen && selected !== null}
                        options={b.options}
                        optionCount={b.optionCount}
                        optionText={b.optionText}
                        optionTypedChars={b.optionTypedChars}
                        optionFocused={b.optionFocused}
                        optionCaretVisible={b.optionCaretVisible}
                        scrollTop={conf.scrollTop}
                        labels={labels}
                      />
                      {thumb(conf)}
                      {inputTypeMenuOpen && selected ? (
                        // The app portals this under <body> (position: fixed at the trigger's bottom-left);
                        // here it sits at the same spot inside the column, which it never overflows.
                        <div
                          style={{
                            position: "absolute",
                            left: INPUT_TYPE_TRIGGER.left,
                            top: INPUT_TYPE_TRIGGER.top + INPUT_TYPE_TRIGGER.height - conf.scrollTop,
                            minWidth: "max-content",
                            zIndex: 50,
                          }}
                        >
                          <InputTypeMenu
                            value={selected.type}
                            highlightedValue={inputTypeMenuHighlighted}
                            progress={inputTypeMenuProgress}
                            triggerWidth={triggerWidth}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 p-0 pt-6 border-t border-border flex-shrink-0">
                  <button
                    className={UPDATE_BTN}
                    disabled={updateState === "disabled"}
                    type="submit"
                    style={updateState === "pressed" ? { backgroundColor: "hsl(var(--primary) / 0.9)" } : undefined}
                  >
                    {L.updateTemplate}
                  </button>
                </div>
              </div>
            </div>
          </section>
          <div data-state="open" data-slot="collapsible">
            <CollapsibleHeader
              title={L.apiKeys}
              count={template.apiKeys}
              action={
                <button className={SECTION_ACTION}>
                  <KeyRound className="h-4 w-4" />
                  {L.addApiKey}
                </button>
              }
            />
            {/* Only the empty state was captured; a template with keys shows its list here (not rebuilt). */}
            {template.apiKeys === 0 ? (
              <EmptyState icon={<KeyRound strokeWidth={1.5} className="h-8 w-8 text-muted-foreground" aria-hidden="true" />} text={L.noApiKeys} />
            ) : null}
          </div>
          <div data-state="open" data-slot="collapsible">
            <CollapsibleHeader
              title={L.webhooks}
              count={template.webhooks}
              action={
                <button className={SECTION_ACTION}>
                  <Webhook className="h-4 w-4" />
                  {L.addWebhook}
                </button>
              }
            />
            {template.webhooks === 0 ? (
              <EmptyState icon={<Webhook strokeWidth={1.5} className="h-8 w-8 text-muted-foreground" aria-hidden="true" />} text={L.noWebhooks} />
            ) : null}
          </div>
          <div data-state="open" data-slot="collapsible">
            <CollapsibleHeader title={L.boards} count={template.boards.length} />
            <BoardsTable rows={template.boards} labels={L} />
          </div>
        </div>
      </div>
    </div>
  );
};
