/**
 * Screen group "onboarding-deploy-people": registry entries (capture-match + fixtures variants).
 * screens/index.ts spreads `onboardingDeployPeopleScreens` into the gallery.
 */
import type { TulvoUiScreen } from "../types";
import { onboardingScreens } from "./variants-onboarding";
import { deployPeopleScreens } from "./variants-deploy-people";

export const onboardingDeployPeopleScreens: TulvoUiScreen[] = [...onboardingScreens, ...deployPeopleScreens];

export * from "./OnboardingScreens";
export * from "./DeployGalleryScreen";
export * from "./DeployEditorScreen";
export * from "./CustomDomainDialog";
export * from "./ConnectDataModal";
export * from "./PeopleScreen";
export * from "./IntegrationConnectScreen";
export * from "./PersonaSite";
