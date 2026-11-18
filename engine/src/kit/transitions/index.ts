// Transitions (LIBRARY-PLAN phase 5): each takes the outgoing scene as `children`, the incoming one as `next` (its
// clock starts at 0 when it takes over) and the cue `at`. Every one works in all four frame sizes, passes the flash
// check, and names its sound in library/motion/index.json. The stylised five (light leak, glitch cut, ripple, ink
// bleed, film burn) are marked "use sparingly".

// Wipes
export { Blinds } from './Blinds';
export { ClockWipe } from './ClockWipe';
export { DipToColour } from './DipToColour';
export { DoorSplit } from './DoorSplit';
export { FeatherWipe } from './FeatherWipe';
export { IrisWipe } from './IrisWipe';
export { PanelWipe } from './PanelWipe';
export { PushWipe } from './PushWipe';

// Optical and camera
export { BlurThrough } from './BlurThrough';
export { ExposureBloom } from './ExposureBloom';
export { InvertFlash } from './InvertFlash';
export { MatchCut } from './MatchCut';
export { ParallaxPush } from './ParallaxPush';
export { SpinWhip } from './SpinWhip';
export { WhipPan } from './WhipPan';
export { ZoomBlur } from './ZoomBlur';

// Turns, tiles and the brand
export { CardFlip } from './CardFlip';
export { CubeTurn } from './CubeTurn';
export { LogoMaskWipe } from './LogoMaskWipe';
export { LumaDissolve } from './LumaDissolve';
export { PageTurn } from './PageTurn';
export { PixelateThrough } from './PixelateThrough';
export { TileReveal } from './TileReveal';
export { TitleTakeover } from './TitleTakeover';

// Stylised: use sparingly
export { FilmBurn } from './FilmBurn';
export { GlitchCut } from './GlitchCut';
export { InkBleed } from './InkBleed';
export { LightLeak } from './LightLeak';
export { Ripple } from './Ripple';
