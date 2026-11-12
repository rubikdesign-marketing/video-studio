// Every move in the library with its gallery scene, in the order the reel plays them. A move enters the library
// only with an entry here and one in library/motion/index.json; `name` is the same in both.
import type { FC } from 'react';
import type { StageName } from '../../../kit/tokens';
import {
  CameraScene,
  ContainerTransformScene,
  LightSweepScene,
  PushThroughScene,
  RelayScrollScene,
  SlideOffRevealScene,
  ZoomThroughSwapScene,
} from './camera';
import { CursorLeadScene, IconDoorScene, MomentumCutScene, ParallaxCameraScene, SharedElementScene } from './journeys';
import { BarGrowScene, CountWithBarScene, FocusPullScene, LiftScene, LineDrawScene, RingSweepScene, StaggerScene } from './emphasis';
import { BlurInScene, DrawnMarkScene, NumberRollScene, RotatingWordScene, SwapWordScene, TrackingSettleScene, TypeOnScene } from './type';

export type Demo = {
  /** The move's name in the catalogue. Its composition is "move-<name>" and its preview library/motion/<name>.mp4. */
  name: string;
  /** The caption, in sentence case. */
  title: string;
  /** Length of the scene in seconds: 3 to 5. */
  seconds: number;
  /** The scene. It is told which page the gallery is on, for moves that go from one page to the other. */
  Scene: FC<{ page: StageName }>;
};

export const demos: Demo[] = [
  // Type
  { name: 'blur-in', title: 'Blur in', seconds: 4, Scene: BlurInScene },
  { name: 'tracking-settle', title: 'Tracking settle', seconds: 4, Scene: TrackingSettleScene },
  { name: 'rotating-word', title: 'Rotating word', seconds: 5, Scene: RotatingWordScene },
  { name: 'number-roll', title: 'Number roll', seconds: 3.5, Scene: NumberRollScene },
  { name: 'type-on', title: 'Type on', seconds: 4.5, Scene: TypeOnScene },
  { name: 'swap-word', title: 'Swap word', seconds: 4, Scene: SwapWordScene },
  { name: 'drawn-mark', title: 'Drawn mark', seconds: 4.5, Scene: DrawnMarkScene },
  // Emphasis on a product screen
  { name: 'focus-pull', title: 'Focus pull', seconds: 4.5, Scene: FocusPullScene },
  { name: 'lift', title: 'Lift', seconds: 4, Scene: LiftScene },
  { name: 'stagger', title: 'Stagger with a source', seconds: 4.2, Scene: StaggerScene },
  // Data
  { name: 'count-with-bar', title: 'Count with its bar', seconds: 3.5, Scene: CountWithBarScene },
  { name: 'bar-grow', title: 'Bar grow', seconds: 3.5, Scene: BarGrowScene },
  { name: 'line-draw', title: 'Line draw', seconds: 3.5, Scene: LineDrawScene },
  { name: 'ring-sweep', title: 'Ring sweep', seconds: 3.5, Scene: RingSweepScene },
  // Camera and transitions
  { name: 'camera', title: 'Camera push', seconds: 4, Scene: CameraScene },
  { name: 'container-transform', title: 'Container transform', seconds: 4.5, Scene: ContainerTransformScene },
  { name: 'push-through', title: 'Push through', seconds: 4.5, Scene: PushThroughScene },
  { name: 'relay-scroll', title: 'Relay scroll', seconds: 4.5, Scene: RelayScrollScene },
  { name: 'zoom-through-swap', title: 'Zoom-through swap', seconds: 4.5, Scene: ZoomThroughSwapScene },
  { name: 'slide-off-reveal', title: 'Slide-off reveal', seconds: 4.5, Scene: SlideOffRevealScene },
  { name: 'light-sweep', title: 'Light sweep', seconds: 3.5, Scene: LightSweepScene },
  // Through a product
  { name: 'parallax-camera', title: 'Parallax camera', seconds: 4, Scene: ParallaxCameraScene },
  { name: 'momentum-cut', title: 'Momentum cut', seconds: 4, Scene: MomentumCutScene },
  { name: 'shared-element', title: 'Shared element', seconds: 4.5, Scene: SharedElementScene },
  { name: 'cursor-lead', title: 'Cursor lead', seconds: 4.5, Scene: CursorLeadScene },
  { name: 'icon-door', title: 'The icon is a door', seconds: 5, Scene: IconDoorScene },
];
