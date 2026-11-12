/**
 * Registers every rebuilt Tulvo screen (screens/index.ts) as a composition
 * "TulvoUi-<id>" at the captured desktop size (1512x805, 30 fps, 1 frame unless the
 * screen says otherwise), inside the "TulvoUi" folder of the Studio sidebar.
 *
 * Root.tsx renders <TulvoUiGallery /> once; screen teams never touch Root.tsx.
 */
import React from "react";
import { Composition, Folder } from "remotion";
import { APP_HEIGHT, APP_WIDTH, TulvoApp } from "./TulvoApp";
import { tulvoUiScreens, type TulvoUiScreen } from "./screens";

export const TULVO_UI_FPS = 30;

// Wrap each screen once at module scope (a new component per render would remount it).
const wrap = (screen: TulvoUiScreen) => {
  const Screen = screen.component;
  const Wrapped: React.FC<Record<string, unknown>> = (props) => (
    <TulvoApp width={screen.width ?? APP_WIDTH} height={screen.height ?? APP_HEIGHT}>
      <Screen {...props} />
    </TulvoApp>
  );
  Wrapped.displayName = `TulvoUi(${screen.id})`;
  return Wrapped;
};

const entries = tulvoUiScreens.map((s) => ({ screen: s, Component: wrap(s) }));

const seen = new Set<string>();
for (const { screen } of entries) {
  if (!/^[A-Za-z0-9-]+$/.test(screen.id)) throw new Error(`TulvoUi screen id "${screen.id}": use letters, digits and "-" only`);
  if (seen.has(screen.id)) throw new Error(`TulvoUi screen id "${screen.id}" is registered twice`);
  seen.add(screen.id);
}

export const TulvoUiGallery: React.FC = () => (
  <Folder name="TulvoUi">
    {entries.map(({ screen, Component }) => (
      <Composition
        key={screen.id}
        id={`TulvoUi-${screen.id}`}
        component={Component}
        defaultProps={screen.defaultProps}
        durationInFrames={screen.durationInFrames ?? 1}
        fps={screen.fps ?? TULVO_UI_FPS}
        width={screen.width ?? APP_WIDTH}
        height={screen.height ?? APP_HEIGHT}
      />
    ))}
  </Folder>
);
