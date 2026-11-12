/**
 * Integrations: "Connect Slack Workspace" / "Connect Notion Workspace" (/integrations?integration=slack|notion).
 * No DOM snapshot exists; markup and class strings are the app bundle's own components
 * (IntegrationsPage `WJ`, the empty card `mA`, its banner `/assets/banner-bg-*.png`, the Tulvo tile `WFe`
 * and the bullet icon `KFe`), checked against day2/04 and day2/05.
 *
 * THIRD-PARTY MARKS: the live tile on the right shows the vendor's logo. Here it is the `logo` prop and
 * defaults to the neutral <IntegrationLogoSlot/>. Vendor names appear as plain text only.
 */
import React from "react";
import { Img } from "remotion";
import { Compass, Link2, Loader2 } from "lucide-react";
import type { SidebarData, Workspace } from "../../fixtures";
import { IntegrationLogoSlot } from "../../icons/IntegrationLogoSlot";
import { AppShell } from "../../shell/AppShell";
import { INTEGRATION_CHECK_SVG, INTEGRATION_TULVO_TILE_SVG } from "./app-svgs";
import { INTEGRATION_BANNER_BG } from "./assets";

export type IntegrationConnectScreenProps = {
  workspace: Workspace;
  sidebar: SidebarData;
  /** Plain-text vendor name, e.g. "Slack" / "Notion" (breadcrumb, aria label, default button label). */
  vendorName: string;
  title: string;
  subtitle: string;
  features: string[];
  /** Live label: `Connect ${vendorName} workspace`. */
  buttonLabel: string;
  /** "loading" is the app's own pending state (spinner + "Connecting..."). */
  buttonState: "idle" | "hover" | "loading";
  connectingLabel: string;
  /** Logo tile content (26x26). Default: neutral placeholder tile, never a vendor logo. */
  logo?: React.ReactNode;
  crumbHome: string;
  showTourButton: boolean;
  showCookieSettings: boolean;
  sidebarScrollTop: number;
};

const TILE = "flex items-center justify-center rounded-[18px] border-[1.12px] border-[#e8e8e8] bg-card p-3";
const BTN =
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none py-2 integration-empty-card-btn h-8 gap-1 rounded-[10px] px-2.5";

export const IntegrationConnectScreen: React.FC<IntegrationConnectScreenProps> = (p) => (
  <AppShell
    workspace={p.workspace}
    sidebar={p.sidebar}
    crumbs={[{ label: p.crumbHome }, { label: p.vendorName }]}
    showCookieSettings={p.showCookieSettings}
    sidebarScrollTop={p.sidebarScrollTop}
  >
    <div className="integration-page h-screen w-full overflow-y-auto bg-background">
      {p.showTourButton ? (
        <button
          className="inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground fixed bottom-4 right-4 z-40 h-8 w-8 shrink-0 rounded-full border bg-background shadow-md"
          aria-label="Replay Integrations Tour"
          data-state="closed"
        >
          <Compass className="h-4 w-4" />
        </button>
      ) : null}
      <div className="w-full px-4 lg:px-[3.375rem] py-6 lg:py-8">
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="integration-content-section">
              <div className="integration-empty-card mx-auto flex w-full max-w-[656px] flex-col items-center gap-8 py-14">
                <div
                  className="relative h-[160px] w-full overflow-hidden rounded-[24px] border border-[#0a0a0a] bg-[#f0f0f0]"
                  aria-label={`Connect Tulvo to ${p.vendorName}`}
                >
                  <Img aria-hidden src={INTEGRATION_BANNER_BG} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center gap-3">
                      <div className={TILE}>
                        <span className="flex size-[26px] items-center justify-center">
                          <Img src={INTEGRATION_TULVO_TILE_SVG} alt="Tulvo" width={26} height={26} />
                        </span>
                      </div>
                      <div className="h-px w-6 rounded-full bg-white" />
                      <div className="flex items-center justify-center rounded-[32px] bg-white/30 p-2 backdrop-blur-md">
                        <Link2 className="h-4 w-4 text-foreground/70" />
                      </div>
                      <div className="h-px w-6 rounded-full bg-white" />
                      <div className={TILE}>
                        <span className="flex size-[26px] items-center justify-center">{p.logo ?? <IntegrationLogoSlot size={26} />}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2 text-center">
                  <h5 className="integration-empty-card-title text-xl font-medium">{p.title}</h5>
                  <p className="integration-empty-card-subtitle text-sm text-muted-foreground">{p.subtitle}</p>
                </div>
                <div className="flex w-[289px] flex-col gap-3">
                  {p.features.map((c) => (
                    <div className="flex items-center gap-2" key={c}>
                      <Img src={INTEGRATION_CHECK_SVG} alt="" width={16} height={16} className="shrink-0" />
                      <span className="text-sm text-muted-foreground">{c}</span>
                    </div>
                  ))}
                </div>
                <button
                  className={BTN}
                  disabled={p.buttonState === "loading"}
                  style={p.buttonState === "hover" ? { backgroundColor: "hsl(var(--primary) / 0.9)" } : undefined}
                >
                  {p.buttonState === "loading" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {p.connectingLabel}
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4" />
                      {p.buttonLabel}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppShell>
);

/** Live copy (bundle `mA` callers + `qFe`). */
export const INTEGRATION_COPY = {
  features: ["Schema structural integrity verification", "Real-time webhook auto-sync triggers"],
  connectingLabel: "Connecting...",
  slack: {
    vendorName: "Slack",
    title: "Connect Slack Workspace",
    subtitle: "Connect your Slack workspace to send notifications and manage integrations.",
    buttonLabel: "Connect Slack workspace",
  },
  notion: {
    vendorName: "Notion",
    title: "Connect Notion Workspace",
    subtitle: "Connect your Notion workspace to sync databases and pages, map fields, and automate your workflow.",
    buttonLabel: "Connect Notion workspace",
  },
};
