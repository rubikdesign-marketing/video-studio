// The library of moves: small animations a scene can reuse. Each is driven by cues in seconds on the scene clock,
// takes its lengths from the motion tokens and the energy preset, and its colours and type from the brand in use.
// The catalogue (what each move is for, when to use it and when not to) is library/motion/index.json; every move
// has a working example in src/library/motion.

// Type
export { BlurIn } from './BlurIn';
export { DrawnMark } from './DrawnMark';
export { NumberRoll } from './NumberRoll';
export { RotatingWord } from './RotatingWord';
export { SwapWord } from './SwapWord';
export { TrackingSettle } from './TrackingSettle';
export { TypeOn } from './TypeOn';

// Emphasis on a product screen
export { FocusPull } from './FocusPull';
export { Lift } from './Lift';
export { Stagger } from './Stagger';

// Data
export { BarGrow } from './BarGrow';
export { Count, CountWithBar } from './CountWithBar';
export { LineDraw } from './LineDraw';
export { RingSweep } from './RingSweep';

// Camera and transitions
export { Camera, type CameraShot } from './Camera';
export { ContainerTransform } from './ContainerTransform';
export { CursorLead, Pressed } from './CursorLead';
export { IconDoor } from './IconDoor';
export { LightSweep } from './LightSweep';
export { MomentumCut } from './MomentumCut';
export { ParallaxCamera } from './ParallaxCamera';
export { PushThrough } from './PushThrough';
export { RelayScroll } from './RelayScroll';
export { SharedElement } from './SharedElement';
export { SlideOffReveal } from './SlideOffReveal';
export { ZoomThroughSwap } from './ZoomThroughSwap';

// Shapes and interface components that change into one another
export { Carrier, useFullStop, type CarrierKey, type CarriedShape } from './Carrier';
export { SliderDrag, TabIndicator, ToggleFlip, toggleKnob, type SliderKey, type TabKey } from './Controls';
export { Flood } from './Flood';
export { MorphChain, type ChainState } from './MorphChain';
export { ParticleForm, type ParticleKey, type ParticleTarget } from './ParticleForm';
export { ShapeMorph, shapeAt, type ShapeKey } from './ShapeMorph';
export { outline, pathOf, useSnap, type FillRole, type Shape } from './shape';

// Motion blur matched to speed, for scenes that move things of their own
export { MotionBlur, useTravel, type Rect, type Side } from './core';
