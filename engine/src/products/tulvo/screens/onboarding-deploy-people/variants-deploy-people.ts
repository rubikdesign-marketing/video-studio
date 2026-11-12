/**
 * Deploy / People / Integrations variants.
 *  capture-match (same state and counts as the capture, cleared names; the account Callie Pembrook -> "CP"):
 *    Deploy-Gallery-Capture          dom/deploy-gallery.html
 *    Deploy-Editor-Preview-Capture   dom/deploy-editor-preview.html
 *    Deploy-Editor-Edit-Capture      dom/deploy-editor-edit-mode.html ("Select an element to edit")
 *    Deploy-Editor-Selected-Capture  day2/11 + dom/deploy-editor-element-selected.html (H1 selected)
 *    Deploy-CustomDomain-Capture     day2/01
 *    Deploy-ConnectData-Capture      day2/13 + dom/deploy-database-panel.html
 *    People-Capture                  day2/03 + dom/people-members.html (1 owner, 0 pending)
 *    Integration-Slack-Capture       day2/04
 *    Integration-Notion-Capture      day2/05
 *  fixtures (the ad's defaults, tulvoFixtures):
 *    Deploy-Gallery, Deploy-Editor (Edit, H1 selected), Deploy-Editor-Preview, Deploy-CustomDomain,
 *    Deploy-ConnectData, People (3 members), People-Pending (Dani Halloran invited as Admin),
 *    Integration-Slack, Integration-Notion
 */
import { captureMatch, tulvoFixtures, type TulvoDataset } from "../../fixtures";
import type { TulvoUiScreen } from "../types";
import { API_PERMISSIONS_CAPTURED, CONNECT_DATA_LABELS, type ConnectDataModalProps } from "./ConnectDataModal";
import { CUSTOM_DOMAIN_COPY } from "./CustomDomainDialog";
import { DEPLOY_GALLERY_LABELS, DEPLOY_TEMPLATES_CAPTURED, DeployGalleryScreen, type DeployGalleryScreenProps } from "./DeployGalleryScreen";
import {
  DEPLOY_EDITOR_LABELS,
  DEPLOY_INSPECTOR_LABELS,
  DeployEditorScreen,
  type DeployEditorScreenProps,
  type EditorSelection,
} from "./DeployEditorScreen";
import { INTEGRATION_COPY, IntegrationConnectScreen, type IntegrationConnectScreenProps } from "./IntegrationConnectScreen";
import { PEOPLE_LABELS, PeopleScreen, type PeopleScreenProps } from "./PeopleScreen";
import { PERSONA_SITE } from "./PersonaSite";

const ACCOUNT_INITIALS = "CP"; // Callie Pembrook (capture: the test account's initials)

/** The H1 selection as captured (app CSS px). */
export const H1_SELECTION: EditorSelection = {
  top: 178.447,
  left: 681.469,
  width: 374.062,
  height: 23.9999,
  label: "Heading",
  tag: "h1",
  path: ["Home", "Container", "Heading"],
};

const connectData = (o: Partial<ConnectDataModalProps> = {}): ConnectDataModalProps => ({
  activeNav: "configure",
  connectedCount: 1,
  permissions: API_PERMISSIONS_CAPTURED,
  fieldSetName: PERSONA_SITE.formTitle,
  fieldSetAction: "Use Existing Template",
  templateName: tulvoFixtures.waitlistTemplateName,
  connected: true,
  fields: [
    { id: "name", name: "Name", type: "Title", include: true },
    { id: "email", name: "Email", type: "Text", include: true },
    { id: "create", name: "What do you create?", type: "Dropdown", optionsLabel: `${PERSONA_SITE.createOptions.length} options`, include: true },
  ],
  maxItems: 40,
  scrollTop: 0,
  saveHover: false,
  opacity: 1,
  labels: CONNECT_DATA_LABELS,
  ...o,
});

const editor = (d: TulvoDataset, o: Partial<DeployEditorScreenProps>, capture: boolean): DeployEditorScreenProps => ({
  workspace: d.workspace,
  sidebar: d.sidebar,
  header: {
    deployLabel: "Deploy",
    siteName: PERSONA_SITE.tag,
    statusLabel: "Draft",
    savedLabel: "Saved",
    mode: "preview",
    modeLabels: { edit: "Edit", preview: "Preview", code: "Code" },
    saveLabel: "Save",
    publishLabel: "Publish",
    publishState: "idle",
    avatarInitials: ACCOUNT_INITIALS,
    avatarColor: "#94FADB",
  },
  site: PERSONA_SITE,
  pageFile: "index.html",
  sections: [
    { id: "section-1", label: "Section 1" },
    // app-generated label from the form's id (truncated in the panel: "Studio for...")
    { id: "studio-form", label: "Studio form 8f35c041 234f 4cd8 9…" },
  ],
  canvas: { preview: { width: 964, height: 673, scale: 0.753125 }, edit: { width: 665, height: 673, scale: 0.519531 } },
  toolbarOffset: { preview: -138, edit: 12 },
  viewportLabel: "1280px",
  selection: null,
  elementBar: { editText: "Edit text", hoverEditText: false },
  inspectorScrollTop: 0,
  activeTool: null,
  labels: DEPLOY_EDITOR_LABELS,
  inspectorLabels: DEPLOY_INSPECTOR_LABELS,
  customDomain: null,
  connectData: null,
  showTourButton: true,
  showCookieSettings: capture,
  sidebarScrollTop: 0,
  ...o,
});
const withMode = (p: DeployEditorScreenProps, mode: "edit" | "preview"): DeployEditorScreenProps => ({ ...p, header: { ...p.header, mode } });

const gallery = (d: TulvoDataset, capture: boolean, o: Partial<DeployGalleryScreenProps> = {}): DeployGalleryScreenProps => ({
  workspace: d.workspace,
  sidebar: d.sidebar,
  templates: DEPLOY_TEMPLATES_CAPTURED,
  allTemplatesCount: 161,
  projects: [
    {
      id: "callie-pembrook-studio",
      name: PERSONA_SITE.tag,
      updatedLabel: `Updated ${capture ? "about 2 hours ago" : d.widgets.updatedLabel}`,
      ownerInitials: ACCOUNT_INITIALS,
      site: PERSONA_SITE,
    },
  ],
  groupLabel: "Public",
  hoveredProjectId: null,
  labels: DEPLOY_GALLERY_LABELS,
  showCookieSettings: capture,
  sidebarScrollTop: 0,
  ...o,
});

const people = (d: TulvoDataset, capture: boolean, o: Partial<PeopleScreenProps> = {}): PeopleScreenProps => ({
  workspace: d.workspace,
  sidebar: d.sidebar,
  activeTab: "users",
  members: d.members,
  pendingInvites: d.pendingInvites,
  viewerCanManage: true,
  hoveredRowId: null,
  inviteButtonState: "idle",
  labels: PEOPLE_LABELS,
  showCookieSettings: capture,
  sidebarScrollTop: 0,
  ...o,
});

const integration = (d: TulvoDataset, which: "slack" | "notion", capture: boolean): IntegrationConnectScreenProps => ({
  workspace: d.workspace,
  sidebar: d.sidebar,
  ...INTEGRATION_COPY[which],
  features: INTEGRATION_COPY.features,
  connectingLabel: INTEGRATION_COPY.connectingLabel,
  buttonState: "idle",
  crumbHome: "Home",
  showTourButton: true,
  showCookieSettings: capture,
  sidebarScrollTop: 0,
});

const E = (id: string, props: DeployEditorScreenProps): TulvoUiScreen<DeployEditorScreenProps> => ({ id, component: DeployEditorScreen, defaultProps: props });
const G = (id: string, props: DeployGalleryScreenProps): TulvoUiScreen<DeployGalleryScreenProps> => ({ id, component: DeployGalleryScreen, defaultProps: props });
const Pp = (id: string, props: PeopleScreenProps): TulvoUiScreen<PeopleScreenProps> => ({ id, component: PeopleScreen, defaultProps: props });
const I = (id: string, props: IntegrationConnectScreenProps): TulvoUiScreen<IntegrationConnectScreenProps> => ({ id, component: IntegrationConnectScreen, defaultProps: props });

const CM = captureMatch;
const FX = tulvoFixtures;

/** Dani Halloran invited as Admin (the "Dani can change it too" beat): fixtures' Dani, status Pending. */
const DANI_PENDING = FX.members.filter((m) => m.id === "m-dani").map((m) => ({ ...m, id: "inv-dani", status: "Pending" as const }));

export const deployPeopleScreens: TulvoUiScreen[] = [
  // ---------------- fixtures (ad defaults)
  G("Deploy-Gallery", gallery(FX, false)),
  E("Deploy-Editor", withMode(editor(FX, { selection: H1_SELECTION }, false), "edit")),
  E("Deploy-Editor-Preview", editor(FX, {}, false)),
  E("Deploy-CustomDomain", editor(FX, { customDomain: CUSTOM_DOMAIN_COPY }, false)),
  E("Deploy-ConnectData", editor(FX, { connectData: connectData() }, false)),
  Pp("People", people(FX, false)),
  Pp("People-Pending", people(FX, false, { activeTab: "pending", members: FX.members.filter((m) => m.id === "m-callie"), pendingInvites: DANI_PENDING })),
  I("Integration-Slack", integration(FX, "slack", false)),
  I("Integration-Notion", integration(FX, "notion", false)),
  // ---------------- capture-match
  G("Deploy-Gallery-Capture", gallery(CM, true)),
  E("Deploy-Editor-Preview-Capture", editor(CM, {}, true)),
  E("Deploy-Editor-Edit-Capture", withMode(editor(CM, {}, true), "edit")),
  E("Deploy-Editor-Selected-Capture", withMode(editor(CM, { selection: H1_SELECTION }, true), "edit")),
  E("Deploy-CustomDomain-Capture", editor(CM, { customDomain: CUSTOM_DOMAIN_COPY }, true)),
  E("Deploy-ConnectData-Capture", editor(CM, { connectData: connectData() }, true)),
  Pp("People-Capture", people(CM, true)),
  I("Integration-Slack-Capture", integration(CM, "slack", true)),
  I("Integration-Notion-Capture", integration(CM, "notion", true)),
];
