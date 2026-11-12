/**
 * Screen group "templates" (Data Templates list + quick look, Edit properties). See
 * Tulvo ad ui-rebuild/templates.md for components, props and fidelity results.
 */
import type { TulvoUiScreen } from "../types";
import { templatesB11DemoScreen } from "./TemplatesB11Demo";
import { templatesStillScreens } from "./TemplatesScreens";

/** Every gallery entry of this group (registered in ../index.ts). */
export const templatesScreens: TulvoUiScreen[] = [...templatesStillScreens, templatesB11DemoScreen];

export * from "./data";
export * from "./parts";
export * from "./DataTemplatesList";
export * from "./TemplateEditProperties";
export * from "./TemplatesScreens";
export { TemplatesB11Demo, type TemplatesB11DemoProps } from "./TemplatesB11Demo";
