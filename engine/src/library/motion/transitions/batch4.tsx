// Gallery scenes for the stylised transitions (light leak, glitch cut, ripple, ink bleed, film burn). Each shows its
// move once, in a small realistic setup: a line is read on the outgoing page, then the next scene (on the other
// page) arrives. The incoming scene is simply there: the move is what brings it in.
import type { CSSProperties, FC } from 'react';
import { FilmBurn } from '../../../kit/transitions/FilmBurn';
import { GlitchCut } from '../../../kit/transitions/GlitchCut';
import { InkBleed } from '../../../kit/transitions/InkBleed';
import { LightLeak } from '../../../kit/transitions/LightLeak';
import { Ripple } from '../../../kit/transitions/Ripple';
import type { StageName } from '../../../kit/tokens';
import { Panel } from '../../../kit/ui';
import { Centre, Line } from '../parts';
import type { SizedDemo } from '../sized';

type OnPage = { page: StageName };
const otherPage = (page: StageName): StageName => (page === 'light' ? 'dark' : 'light');
const centred: CSSProperties = { textAlign: 'center' };
const fill: CSSProperties = { position: 'absolute', inset: 0 };

/** The outgoing scene: a small label and a headline that is read before the move starts. */
const Before: FC<{ label: string; title: string }> = ({ label, title }) => (
  <Centre gap={2.4}>
    <Line voice="label" size={2.8} colour="second" at={0.1}>
      {label}
    </Line>
    <Line size={8} at={0.2} style={centred}>
      {title}
    </Line>
  </Centre>
);

/** The incoming scene, on the other page. */
const After: FC<{ page: StageName; label: string; title: string }> = ({ page, label, title }) => (
  <Panel name={otherPage(page)} style={fill}>
    <Centre gap={2.4}>
      <Line voice="label" size={2.8} colour="accent">
        {label}
      </Line>
      <Line size={8} style={centred}>
        {title}
      </Line>
    </Centre>
  </Panel>
);

const LightLeakScene: FC<OnPage> = ({ page }) => (
  <LightLeak at={1.5} next={<After page={page} label="Out now" title={'Shop the\nnew collection'} />}>
    <Before label="Summer drop" title={'It is finally\nhere'} />
  </LightLeak>
);

const GlitchCutScene: FC<OnPage> = ({ page }) => (
  <GlitchCut at={1.5} next={<After page={page} label="Version 2.0" title={'Twice as fast'} />}>
    <Before label="Before" title={'Slow\nand clunky'} />
  </GlitchCut>
);

const RippleScene: FC<OnPage> = ({ page }) => (
  <Ripple at={1.6} origin={{ x: 0.5, y: 0.5 }} next={<After page={page} label="Order 4821" title={'On its way'} />}>
    <Before label="Checkout" title={'Order\nplaced'} />
  </Ripple>
);

const InkBleedScene: FC<OnPage> = ({ page }) => (
  <InkBleed at={1.5} next={<After page={page} label="Meet the maker" title={'Made by hand\nin Lisbon'} />}>
    <Before label="Small batches" title={'Every piece\nis different'} />
  </InkBleed>
);

const FilmBurnScene: FC<OnPage> = ({ page }) => (
  <FilmBurn at={1.5} from="left" next={<After page={page} label="Chapter two" title={'The next\nreel'} />}>
    <Before label="Chapter one" title={'Where it\nstarted'} />
  </FilmBurn>
);

export const batch4: SizedDemo[] = [
  { name: 'light-leak', title: 'Light leak', seconds: 4.5, Scene: LightLeakScene },
  { name: 'glitch-cut', title: 'Glitch cut', seconds: 3.5, Scene: GlitchCutScene },
  { name: 'ripple', title: 'Ripple', seconds: 4.5, Scene: RippleScene },
  { name: 'ink-bleed', title: 'Ink bleed', seconds: 4.5, Scene: InkBleedScene },
  { name: 'film-burn', title: 'Film burn', seconds: 4.5, Scene: FilmBurnScene },
];
