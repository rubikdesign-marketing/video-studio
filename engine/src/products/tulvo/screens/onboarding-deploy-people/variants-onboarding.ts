/**
 * Onboarding variants.
 *  - capture-match: same state/layout as the live screenshot, cleared names
 *      Onboarding-Basic       day1/01  (Basic Workspace, empty)
 *      Onboarding-AiActive    day2/12  (Use Tulvo AI, empty)            == dom/onboarding-ai-active.html
 *      Onboarding-Named       day1/03  (name typed + "is available")    capture workspace -> Callie Pembrook Studio
 *      Onboarding-Filled      day1/04  (scrolled, work type + description typed, Startups hovered, Start Creating on)
 *      Onboarding-Progress-12/44/73/97/99   day1/08, 07, 06, 10, 09
 *  - fixtures (the ad's defaults):
 *      Onboarding             everything typed, description focused with caret, Start Creating pressed
 *      Onboarding-Progress    mid-run (step 5 of 7)
 */
import { tulvoFixtures } from "../../fixtures";
import type { TulvoUiScreen } from "../types";
import {
  ONBOARDING_PROGRESS_DEFAULTS,
  ONBOARDING_WORK_DEFAULTS,
  OnboardingProgressScreen,
  OnboardingWorkScreen,
  type OnboardingProgressScreenProps,
  type OnboardingWorkScreenProps,
} from "./OnboardingScreens";

/** The Day-1 input recorded live (13-product-truth: 97 characters). Persona copy, no third parties. */
export const DAY1_WORK_TYPE = "Creator studio";
export const DAY1_DESCRIPTION = "I run a six-person creator studio with brand deals, content, a media kit and a workshop waitlist.";

const work = (o: Partial<OnboardingWorkScreenProps>): OnboardingWorkScreenProps => ({
  ...ONBOARDING_WORK_DEFAULTS,
  workspaceName: "",
  workspaceNameTypedChars: null,
  showNameAvailable: false,
  useAi: true,
  switchProgress: null,
  workType: "",
  workTypeTypedChars: null,
  description: "",
  descriptionTypedChars: null,
  hoveredWorkflow: null,
  focusedField: null,
  caretVisible: false,
  startCreating: "auto",
  scrollTop: 0,
  showCookieSettings: true,
  ...o,
});

const progress = (o: Partial<OnboardingProgressScreenProps>): OnboardingProgressScreenProps => ({
  ...ONBOARDING_PROGRESS_DEFAULTS,
  phase: "preparing",
  progress: 0,
  spinnerAngle: 0,
  pingProgress: 1,
  scrollTop: 0,
  showCookieSettings: true,
  ...o,
});

const W = (id: string, props: OnboardingWorkScreenProps): TulvoUiScreen<OnboardingWorkScreenProps> => ({
  id,
  component: OnboardingWorkScreen,
  defaultProps: props,
});
const P = (id: string, props: OnboardingProgressScreenProps): TulvoUiScreen<OnboardingProgressScreenProps> => ({
  id,
  component: OnboardingProgressScreen,
  defaultProps: props,
});

export const onboardingScreens: TulvoUiScreen[] = [
  // fixtures (ad defaults)
  W(
    "Onboarding",
    work({
      workspaceName: tulvoFixtures.workspace.name,
      showNameAvailable: true,
      workType: DAY1_WORK_TYPE,
      description: DAY1_DESCRIPTION,
      focusedField: "description",
      caretVisible: true,
      startCreating: "pressed",
      showCookieSettings: false,
    }),
  ),
  P("Onboarding-Progress", progress({ progress: 66.4, spinnerAngle: 140, pingProgress: 0.35, showCookieSettings: false })),
  // capture-match
  W("Onboarding-Basic", work({ useAi: false })),
  W("Onboarding-AiActive", work({})),
  W("Onboarding-Named", work({ workspaceName: tulvoFixtures.workspace.name, showNameAvailable: true })),
  W(
    "Onboarding-Filled",
    work({
      workspaceName: tulvoFixtures.workspace.name,
      showNameAvailable: true,
      workType: DAY1_WORK_TYPE,
      description: DAY1_DESCRIPTION,
      hoveredWorkflow: 4,
      focusedField: "description",
      scrollTop: 235,
    }),
  ),
  P("Onboarding-Progress-12", progress({ progress: 11.9, spinnerAngle: 300 })),
  P("Onboarding-Progress-44", progress({ progress: 43.9, spinnerAngle: 0 })),
  P("Onboarding-Progress-73", progress({ progress: 73.2, spinnerAngle: 0 })),
  P("Onboarding-Progress-97", progress({ progress: 96.8, spinnerAngle: 0 })),
  P("Onboarding-Progress-99", progress({ progress: 99, spinnerAngle: 0 })),
];
