/**
 * Registry of rebuilt Tulvo screens. Gallery.tsx turns every entry into a
 * "TulvoUi-<id>" composition.
 *
 * TO ADD A SCREEN: create screens/<Name>Screen.tsx exporting a `TulvoUiScreen`
 * (see ./types.ts and ShellScreen.tsx), then add ONE import line and ONE array entry
 * below. Keep entries alphabetical after "Shell" to avoid merge conflicts.
 */
import type { TulvoUiScreen } from "./types";
import { shellScreen } from "./ShellScreen";
import { boardsScreens } from "./boards";
import { homeScreens } from "./home";
import { onboardingDeployPeopleScreens } from "./onboarding-deploy-people";
import { templatesScreens } from "./templates";

export const tulvoUiScreens: TulvoUiScreen[] = [
  shellScreen,
  ...boardsScreens,
  ...homeScreens,
  ...onboardingDeployPeopleScreens,
  ...templatesScreens,
];

export type { TulvoUiScreen } from "./types";
