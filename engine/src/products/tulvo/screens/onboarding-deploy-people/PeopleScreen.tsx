/**
 * People (/people), rebuilt from research/ui-live/dom/people-members.html (class strings verbatim).
 * The capture holds one member (the owner, "You") and an empty Pending tab. Rows for other members and
 * for pending invitations follow the app bundle's own components (`MemberRow` `Gee`, `MemberPendingRow`
 * `Yee`, table classes `Zt`): a role Select for members the viewer may manage, a delete icon button,
 * and an Email / Role / Status / Action table for invitations. Status cells keep the app's emoji class.
 */
import React from "react";
import { ChevronDown, LogOut, Mail, Trash2, UserPlus } from "lucide-react";
import type { Member, SidebarData, Workspace } from "../../fixtures";
import { AppShell } from "../../shell/AppShell";
import { TopBarSettingsButton } from "../../shell/TopBar";

const TAB =
  "inline-flex dark:text-gray-300 items-center justify-center whitespace-nowrap py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:data-[state=active]:text-white border-transparent dark:data-[state=active]:border-muted-foreground/40 h-7 rounded-lg border-0 bg-transparent px-2.5 text-sm font-normal leading-none text-muted-foreground shadow-none transition-colors data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:font-medium dark:data-[state=active]:bg-[#0A0A0A]";
const PANEL =
  "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=inactive]:hidden";
const TH = "h-10 text-left align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-5 py-4 text-t-muted-bg font-normal whitespace-nowrap";
const TH_ACTION = "h-10 px-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-right pr-5 py-4 text-t-muted-bg font-normal whitespace-nowrap";
const TD = "p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] py-1 align-middle";
const TD_ACTION = "p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-2 py-1 align-middle text-right";
const ROW = "transition-colors data-[state=selected]:bg-muted h-[53px] hover:bg-muted/50 border-b border-border";
const BTN =
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";
/** SelectTrigger (`Fs`) merged with MemberRow's className (tailwind-merge applied by hand). */
const ROLE_SELECT =
  "flex items-center justify-between whitespace-nowrap border-input bg-transparent ring-offset-background placeholder:text-muted-foreground focus:ring-ring dark:focus:ring-0 dark:focus:border-[#3d3d3d] disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 -ml-3 h-auto w-auto min-w-[110px] max-w-[140px] gap-1.5 rounded-lg border-0 px-3 py-1.5 text-sm font-medium text-foreground shadow-none hover:bg-muted/70 focus:outline-none focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 data-[state=open]:ring-0";

/** Status emoji class + label, as the app maps them (`Kee` / `Wee`). */
const STATUS_CLASS: Record<string, string> = { Active: "🟢", Inactive: "⚪", Pending: "🟡", Suspended: "🔴", Declined: "❌" };

export type PeopleScreenProps = {
  workspace: Workspace;
  sidebar: SidebarData;
  activeTab: "users" | "pending";
  members: Member[];
  pendingInvites: Member[];
  /** The viewer may change roles / remove other members (the owner can): role Select + delete button. */
  viewerCanManage: boolean;
  /** Row shown in its hover state (hover:bg-muted/50), by member id. */
  hoveredRowId: string | null;
  /** Invite Member button hover/press look. */
  inviteButtonState: "idle" | "hover";
  labels: {
    users: string;
    pending: string;
    invites: string;
    inviteMember: string;
    you: string;
    headName: string;
    headEmail: string;
    headRole: string;
    headStatus: string;
    headAction: string;
    emptyPendingTitle: string;
    emptyPendingBody: string;
    crumbHome: string;
    crumbPeople: string;
  };
  showCookieSettings: boolean;
  sidebarScrollTop: number;
};

const hoverBg = (on: boolean): React.CSSProperties | undefined => (on ? { backgroundColor: "hsl(var(--muted) / 0.5)" } : undefined);

const MemberRow: React.FC<{ m: Member; p: PeopleScreenProps }> = ({ m, p }) => {
  const manageable = p.viewerCanManage && !m.isYou && m.role !== "Owner";
  return (
    <tr className={ROW} style={hoverBg(p.hoveredRowId === m.id)}>
      <td className={`${TD} px-5 font-medium`}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="relative flex overflow-hidden h-9 w-9 shrink-0 rounded-xl border">
            <div className="flex h-full w-full items-center justify-center rounded-xl bg-muted text-muted-foreground font-medium text-xs" aria-hidden="true">
              {m.initials}
            </div>
          </span>
          <div className="flex min-w-0 flex-col justify-center gap-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-medium leading-tight">{m.name}</span>
              {m.isYou ? (
                <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-border bg-background px-2 text-[10px] font-normal leading-none text-foreground">
                  {p.labels.you}
                </span>
              ) : null}
            </div>
            <span className="truncate text-xs leading-tight text-muted-foreground">{m.email}</span>
          </div>
        </div>
      </td>
      <td className={`${TD} px-5 w-44`}>
        {manageable ? (
          <button type="button" role="combobox" aria-expanded="false" data-state="closed" className={ROLE_SELECT}>
            <span style={{ pointerEvents: "none" }}>{m.role}</span>
            <ChevronDown className="h-4 w-4 opacity-50 ml-1" aria-hidden="true" />
          </button>
        ) : (
          <span className="capitalize text-muted-foreground font-medium">{m.role}</span>
        )}
      </td>
      <td className={`${TD} px-5 w-44`}>
        <div className="flex justify-start">
          <span>
            <span className={STATUS_CLASS[m.status] ?? "⚪"} />
            {m.status}
          </span>
        </div>
      </td>
      <td className={`${TD_ACTION} w-40 pr-5`}>
        <div className="flex justify-end  gap-4">
          {m.isYou ? (
            <button className={`${BTN} hover:bg-accent size-8 text-destructive hover:text-destructive`} data-state="closed">
              <LogOut />
            </button>
          ) : manageable ? (
            <button className={`${BTN} hover:bg-accent hover:text-accent-foreground size-8`}>
              <Trash2 />
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
};

const PendingRow: React.FC<{ m: Member; p: PeopleScreenProps }> = ({ m, p }) => (
  <tr className={ROW} style={hoverBg(p.hoveredRowId === m.id)}>
    <td className={`${TD} px-5 font-medium`}>
      <p className="text-muted-foreground">{m.email}</p>
    </td>
    <td className={`${TD} px-5 capitalize`}>{m.role}</td>
    <td className={`${TD} px-5`}>
      <div className="flex justify-start">
        <span>
          <span className={STATUS_CLASS[m.status] ?? "⚪"} />
          {m.status}
        </span>
      </div>
    </td>
    <td className={`${TD_ACTION} w-60 pr-5`}>
      <div className="flex justify-end gap-2">
        <button className={`${BTN} hover:bg-accent hover:text-accent-foreground size-8`} title="Cancel Invitation">
          <Trash2 className="size-4" />
        </button>
      </div>
    </td>
  </tr>
);

const Table: React.FC<{ head: string[]; children: React.ReactNode }> = ({ head, children }) => (
  <div className="relative w-full overflow-x-auto !scrollbar !scrollbar-h-0.5 scrollbar-track-transparent scrollbar-thumb-transparent hover:scrollbar-thumb-gray-400/50 dark:scrollbar-thumb-transparent dark:hover:scrollbar-thumb-gray-400/50">
    <table className="w-full caption-bottom text-sm">
      <thead className="[&_tr]:border-b bg-t-header-bg border-t">
        <tr className="border-b transition-colors data-[state=selected]:bg-muted h-12 hover:bg-transparent">
          {head.map((h, i) => (
            <th key={h} className={i === head.length - 1 ? TH_ACTION : TH}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="[&_tr:last-child]:border-0">{children}</tbody>
    </table>
  </div>
);

export const PeopleScreen: React.FC<PeopleScreenProps> = (p) => {
  const L = p.labels;
  const usersActive = p.activeTab === "users";
  return (
    <AppShell
      workspace={p.workspace}
      sidebar={p.sidebar}
      crumbs={[{ label: L.crumbHome }, { label: L.crumbPeople }]}
      topBarRight={<TopBarSettingsButton />}
      showCookieSettings={p.showCookieSettings}
      sidebarScrollTop={p.sidebarScrollTop}
    >
      <div className="min-h-0 flex-1 overflow-y-auto pb-24 pt-4">
        <div className="w-full px-4 lg:px-[3.375rem]">
          <div>
            <div dir="ltr" data-orientation="horizontal">
              <div className="flex mb-5 items-center justify-between">
                <div
                  className="inline-flex items-center justify-center text-muted-foreground rounded-lg bg-[#F5F5F5] p-[2px] dark:bg-[#262626]"
                  role="tablist"
                  aria-orientation="horizontal"
                  data-orientation="horizontal"
                  style={{ outline: "none" }}
                >
                  <button className={TAB} type="button" role="tab" aria-selected={usersActive} data-state={usersActive ? "active" : "inactive"} data-orientation="horizontal">
                    {`${L.users} (${p.members.length})`}
                  </button>
                  <button className={TAB} type="button" role="tab" aria-selected={!usersActive} data-state={usersActive ? "inactive" : "active"} data-orientation="horizontal">
                    {L.pending}
                    <span className="ml-1 hidden lg:block">{L.invites}</span>
                    {`(${p.pendingInvites.length})`}
                  </button>
                </div>
                <span className="inline-flex" data-state="closed">
                  <button
                    className={`${BTN.replace(" rounded-md text-sm font-medium", " text-sm")} border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 rounded-[10px] font-normal`}
                    style={p.inviteButtonState === "hover" ? { backgroundColor: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" } : undefined}
                  >
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                    <span className="hidden sm:inline">{L.inviteMember}</span>
                  </button>
                </span>
              </div>
              <div className="mb-4">
                <div className={PANEL} data-state={usersActive ? "active" : "inactive"} data-orientation="horizontal" role="tabpanel">
                  <Table head={[L.headName, L.headRole, L.headStatus, L.headAction]}>
                    {p.members.map((m) => (
                      <MemberRow key={m.id} m={m} p={p} />
                    ))}
                  </Table>
                </div>
                <div className={PANEL} data-state={usersActive ? "inactive" : "active"} data-orientation="horizontal" role="tabpanel">
                  {p.pendingInvites.length > 0 ? (
                    <Table head={[L.headEmail, L.headRole, L.headStatus, L.headAction]}>
                      {p.pendingInvites.map((m) => (
                        <PendingRow key={m.id} m={m} p={p} />
                      ))}
                    </Table>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-4 py-14 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                        <Mail className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="text-base font-semibold text-foreground">{L.emptyPendingTitle}</h3>
                        <p className="max-w-sm text-sm text-muted-foreground">{L.emptyPendingBody}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export const PEOPLE_LABELS: PeopleScreenProps["labels"] = {
  users: "Users",
  pending: "Pending",
  invites: "invites",
  inviteMember: "Invite Member",
  you: "You",
  headName: "Name",
  headEmail: "Email",
  headRole: "Role",
  headStatus: "Status",
  headAction: "Action",
  emptyPendingTitle: "No pending invitations",
  emptyPendingBody: "There are currently no pending invitations. Invite new team members to get started.",
  crumbHome: "Home",
  crumbPeople: "People",
};
