import React from "react";

/**
 * Logo slot for third-party integrations (Slack, Notion, Google ...).
 *
 * The live app shows the vendors' brand logos here. The ad never shows third-party
 * logos, only their names as plain text, so the default is a neutral tile of the same
 * footprint (the app renders the logos at 18x18 inside the sidebar). Pass `logo` to
 * override (e.g. a licensed asset, if counsel ever clears one).
 */
export type IntegrationLogoSlotProps = {
  logo?: React.ReactNode;
  /** Tile size in CSS px (sidebar: 18). */
  size?: number;
  /** Optional single character drawn in the tile (default: none). */
  monogram?: string;
  className?: string;
  style?: React.CSSProperties;
};

export const IntegrationLogoSlot: React.FC<IntegrationLogoSlotProps> = ({
  logo,
  size = 18,
  monogram,
  className,
  style,
}) => {
  if (logo) return <>{logo}</>;
  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: size,
        height: size,
        minWidth: size,
        borderRadius: Math.round(size * 0.25),
        background: "hsl(var(--muted))",
        boxShadow: "inset 0 0 0 1px hsl(var(--border))",
        color: "hsl(var(--muted-foreground))",
        fontSize: Math.round(size * 0.55),
        fontWeight: 600,
        lineHeight: 1,
        ...style,
      }}
    >
      {monogram ?? null}
    </span>
  );
};
