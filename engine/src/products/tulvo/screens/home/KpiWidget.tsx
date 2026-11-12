/**
 * KPI count widget (Prospecting / Pitch Sent / Negotiation / Contract Review on the live Home):
 * muted title + options button, big count, "about 2 hours ago" style label, accent icon.
 * Markup and classes verbatim from home-dashboard.html.
 */
import React from "react";
import { ChartColumn, Hash, Mail, Star } from "lucide-react";
import { formatCount } from "./chartMath";
import type { ChartTone, KpiIconName } from "./types";
import { WidgetOptionsButton } from "./WidgetChrome";

const ICONS: Record<KpiIconName, React.FC<{ className?: string }>> = {
  "chart-column": ChartColumn,
  star: Star,
  hash: Hash,
  mail: Mail,
};

export type KpiWidgetProps = {
  title: string;
  /** Count shown; fractional values (mid-animation) are rounded for display. */
  value: number;
  /** e.g. "about 2 hours ago", "less than a minute ago". */
  updatedLabel: string;
  icon: KpiIconName;
  accent: ChartTone;
};

export const KpiWidget: React.FC<KpiWidgetProps> = ({ title, value, updatedLabel, icon, accent }) => {
  const Icon = ICONS[icon];
  return (
    <div className="group relative flex h-full min-h-0 w-full flex-1 flex-col">
      <div className="group flex w-full min-w-0 flex-col overflow-hidden rounded-2xl bg-widget h-full">
        <div
          className="flex w-full flex-1 flex-col gap-3 rounded-2xl px-4 py-4"
          style={{ "--kpi-accent": `hsl(var(--chart-${accent}))` } as React.CSSProperties}
        >
          <div className="flex h-8 w-full items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <p className="min-w-0 flex-1 truncate text-sm font-normal leading-5 text-muted-foreground" title={title}>
                {title}
              </p>
            </div>
            <WidgetOptionsButton />
          </div>
          <div className="flex h-8 w-full min-w-0 items-center gap-4">
            <span className="min-w-0 truncate text-2xl font-semibold leading-8 text-foreground">{formatCount(value)}</span>
            <span className="min-w-0 shrink-[100] truncate text-xs leading-4 text-muted-foreground" title={updatedLabel}>
              {updatedLabel}
            </span>
            <div className="h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-hidden="true" style={{ color: "var(--kpi-accent)" }}>
              <Icon className="h-full w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
