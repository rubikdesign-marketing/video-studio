// Episode 1 "Website Teardown": what every storyboard shot shows. Times come from timeline.json (the voice); a cue is
// seconds from the shot's start, or a word Kashfiq says in that shot (the first word containing it), so marks land
// on the word. Page boxes are [x, y, w, h] in the captured page's pixels (a 1920 x 1080 viewport), read from each
// capture mark's layout.json and its picture.
export type Box = [number, number, number, number];
export type Tone = 'keep' | 'fix' | 'ask' | 'info';
export type Cue = number | string;
/** A highlight. With `mark`, `box` is where it sat on screen at that capture mark, and it moves with the page. */
export type Ring = { at: Cue; out?: Cue; box: Box; tone: Tone; mark?: string };
/** A pin; `instant` = already showing when the shot starts (carried over from the shot before), `out` = when it goes. */
export type Pin = { at: Cue; out?: Cue; instant?: boolean; x: number; y: number; tone: Tone; text?: string };
export type Note = {
  at: Cue; tone: Tone; tag?: string; text: string;
  kind?: 'timer' | 'concept' | 'steps' | 'dna' | 'motion' | 'contrast';
  /** kind 'contrast': two readings of the same thing, one above the other. */
  cols?: [{ h: string; t: string }, { h: string; t: string }];
  steps?: { text: string; at: Cue }[];
  stop?: Cue;
};
/** Where Kashfiq is during a site shot (b001-n8): his window (pip), not shown (hidden), full-frame and blurred behind
 *  the browser (behind), or cut out in front of it at the bottom right (front). */
export type Presence = 'pip' | 'hidden' | 'behind' | 'front';
export type Site = {
  type: 'site'; cap: string; from: number; to?: number; url: string;
  presence?: Presence;
  /** The page fills the frame: the browser window grows into it (owner, 18 Nov: 'sometimes show the websites full screen'). */
  full?: boolean;
  /** Go to what he names and hold (lib.ts beatAt): at a word, the page moves to a capture mark (or moment `src`) and
   *  frames `view`; `play` lets the capture run on while the view holds. Replaces from/to/zoom for the picture. */
  beats?: { at: Cue; mark?: string; src?: number; view?: Box; play?: number }[];
  /** Play at this speed and hold the last frame, instead of stretching the capture to fill the shot. */
  rate?: number;
  zoom?: { from?: Box; to: Box; at?: Cue; over?: number };
  /** Instead of a zoom: move to the 16:9 view that holds every highlight as it sits at its cue (lib.ts zoomOf). */
  focus?: { at?: Cue; over?: number; margin?: number; minW?: number; from?: Box };
  rings?: Ring[]; pins?: Pin[]; notes?: Note[];
  strip?: { at: Cue; text: string };
  /** A stopwatch on the page itself: counts from `at`, stops on `stop`, then `text` stamps in (b001-n14). */
  timer?: { at: Cue; stop: Cue; text: string };
  /** A full-frame typed line (look.tsx KineticLine). ' / ' breaks the line; *word* lights up in lime. */
  kinetic?: Kinetic;
  /** Spotlight on one box: the rest of the page dims and blurs (look.tsx Spotlight). */
  pause?: { at: Cue; box: Box };
  patch?: { at: Cue; box: Box; bg: string; ink: string; lines: string[]; label: string };
  /** anchor 'right': the new label grows leftwards from the old button's right edge. */
  morph?: { at: Cue; box: Box; from: string; to: string; bg: string; ink: string; anchor?: 'right' };
};
export type Kinetic = { at: Cue; out?: Cue; text: string };
export type ARoll = {
  type: 'aroll';
  kinetic?: Kinetic;
  lower?: { at: Cue; name: string; role: string };
  pills?: { at: Cue; text: string; logo: string }[];
  labels?: { at: Cue; text: string }[];
  cta?: { at: Cue; title: string; sub: string };
  tag?: { at: Cue; text: string };
  sign?: boolean;
  /** Fade and focus in from the forest page instead of a hard cut (b001-n36). */
  soft?: boolean;
};
export type Row = { at: Cue; tone: 'keep' | 'fix'; text: string };
export type Card =
  | { type: 'title' }
  /** The opening (b001-n1): Kashfiq full-frame asks the question as it types on; on "Can you tell?" he moves to a
   *  panel on the left and the site springs in on the right, playing. Runs to `until`. */
  | { type: 'coldopen'; until: number; cap: string; from: number; to: number; url: string; question: string }
  | { type: 'chapter'; n: string; site: string; logo: string; url: string; of: number }
  | { type: 'maxim'; lines: { at: Cue; text: string; hi?: boolean; strike?: boolean }[]; small?: string; kinetic?: Kinetic }
  | { type: 'verdict'; site: string; logo: string; rows: Row[]; until: number }
  | { type: 'path'; until: number }
  | { type: 'lessons'; rules: { at: Cue; n: string; text: string; sub?: string; sub_at?: Cue; dim?: boolean; stills?: string[]; proof?: Proof }[] ; until?: number }
  | { type: 'end' }
  | { type: 'cont' };
/** A lesson's proof: a short clip of a real page with what it is about marked (b001-n38, n39). */
export type Proof = { cap: string; url: string; src: number; play?: number; ring?: Box; pin?: { x: number; y: number; text: string; tone: Tone } };
export type ShotSpec = Site | ARoll | Card;

const FIB = 'fibery.com';
const FOLK = 'folk.app';
const SLITE = 'slite.com';
const FIB_HEAD: Box = [290, 160, 440, 280];
const FIB_PRODUCT: Box = [750, 170, 870, 490];
const SLITE_BTN: Box = [770, 400, 156, 78];
const FULL: Box = [0, 0, 1920, 1080];

export const SPEC: Record<number, ShotSpec> = {
  // ---- cold open and trailer
  1: { type: 'coldopen', until: 3, cap: 'fibery-tour', from: 0.7, to: 9.0, url: FIB, question: 'What does this startup do?' },
  2: { type: 'cont' },
  3: { type: 'cont' },
  4: { type: 'site', presence: 'hidden', cap: 'fibery-hero', from: 3.6, url: FIB, zoom: { from: [160, 80, 1700, 956], to: [240, 110, 1500, 844] },
    rings: [{ at: 0.15, box: FIB_PRODUCT, tone: 'keep', mark: 'hero' }], notes: [{ at: 0.25, tone: 'keep', tag: 'KEEP', text: 'Product, front and centre' }] },
  5: { type: 'site', presence: 'hidden', cap: 'folk-pricing', from: 13.3, url: `${FOLK}/pricing`, zoom: { from: [160, 200, 1600, 900], to: [260, 260, 1400, 788] },
    rings: [{ at: 0.2, box: [323, 358, 1281, 536], tone: 'keep', mark: 'plans' }], notes: [{ at: 0.3, tone: 'info', tag: 'RULE', text: 'Complex pricing makes people leave' }] },
  6: { type: 'site', presence: 'hidden', cap: 'slite-hero', from: 1.2, url: SLITE, zoom: { from: [240, 60, 1440, 810], to: [470, 210, 980, 551] },
    notes: [{ at: 0.3, tone: 'fix', tag: 'FIX · CTA', text: '“Talk to us” doesn’t say what happens next' }] },
  7: { type: 'maxim', lines: [{ at: 0, text: 'Never make your' }, { at: 'users', text: 'users guess.', hi: true }], kinetic: { at: 0.1, text: 'Never make your / *users guess.*' } },
  8: { type: 'title' },
  // ---- premise
  9: { type: 'aroll' },
  10: { type: 'aroll' },
  11: { type: 'aroll' },
  12: { type: 'aroll', lower: { at: 'Kashfiq', name: 'Shiyam Kashfiq', role: 'Co-founder & CEO, Rubik' } },
  13: { type: 'aroll', pills: [
    { at: 'three', text: '', logo: 'fibery' }, { at: 'startup', text: '', logo: 'folk' }, { at: 'websites', text: '', logo: 'slite' }] },
  14: { type: 'aroll', labels: [
    { at: 'think', text: 'How they think about users' }, { at: 'show', text: 'How they show the product' },
    { at: 'better', text: 'What can be done better' }, { at: 'well', text: 'What they did really well' }] },
  15: { type: 'aroll' },
  // ---- 01 Fibery
  16: { type: 'chapter', n: '01', site: 'Fibery', logo: 'fibery', url: FIB, of: 1 },
  17: { type: 'site', presence: 'hidden', cap: 'fibery-hero', from: 1.2, url: FIB, notes: [{ at: 0.2, tone: 'ask', tag: 'REMEMBER THE QUESTION?', text: 'What does this startup do?' }] },
  18: { type: 'site', full: true, presence: 'hidden', beats: [{ at: 0, mark: 'hero' }, { at: 'hero', mark: 'hero', view: [150, 90, 1000, 563] }, { at: 'product', mark: 'hero', view: [690, 70, 1000, 563] }, { at: 'features', mark: 'illustration', view: [300, 349, 1300, 731], play: 0.5 }], cap: 'fibery-tour', from: 0.7, to: 12.4, url: FIB, notes: [
    { at: 'hero', tone: 'info', tag: 'ANATOMY', text: 'Hero' }, { at: 'product', tone: 'info', tag: 'ANATOMY', text: 'Product shot' },
    { at: 'features', tone: 'info', tag: 'ANATOMY', text: 'Features' }, { at: 'illustrations', tone: 'info', tag: 'ANATOMY', text: 'Interactive illustrations' }] },
  19: { type: 'site', presence: 'hidden', beats: [{ at: 0, mark: 'templates' }, { at: 'user', mark: 'templates', view: [470, 190, 960, 540] }, { at: 'templates,', mark: 'templates', view: [310, 340, 1300, 731] }, { at: 'features', mark: 'features', view: [300, 230, 1500, 844] }], cap: 'fibery-tour', from: 15.3, to: 30.5, url: FIB, notes: [
    { at: 'quotations', tone: 'info', tag: 'ANATOMY', text: 'User quotes' }, { at: 'templates', tone: 'info', tag: 'ANATOMY', text: 'Templates' },
    { at: 'features', tone: 'info', tag: 'ANATOMY', text: 'Features with real product shots' }] },
  20: { type: 'site', presence: 'hidden', cap: 'fibery-tour', from: 33.8, url: FIB, notes: [{ at: 'see?', tone: 'ask', tag: 'FIRST THING', text: 'What do you see?' }] },
  21: { type: 'site', presence: 'front', cap: 'fibery-hero', from: 2.0, to: 8.0, url: FIB, zoom: { from: FULL, to: [640, 110, 1090, 613], at: 'product', over: 1.2 },
    rings: [{ at: 'product', box: FIB_PRODUCT, tone: 'keep', mark: 'hero' }],
    notes: [{ at: 'front', tone: 'keep', tag: 'KEEP', text: 'Product, front and centre' }, { at: 'context,', tone: 'info', tag: 'WHY', text: 'New visitors have no context yet' }] },
  22: { type: 'site', presence: 'front', cap: 'fibery-hero', from: 3.0, to: 9.0, url: FIB, zoom: { from: [640, 110, 1090, 613], to: [700, 140, 980, 551] },
    kinetic: { at: 'actual', text: 'Show the product. / People *connect instantly.*' } },
  23: { type: 'site', presence: 'hidden', cap: 'fibery-tour', from: 12.95, url: FIB, zoom: { from: FULL, to: [300, 120, 1320, 743], at: 0.2, over: 7.4 }, notes: [{ at: 'illustrations', tone: 'keep', tag: 'KEEP', text: 'Custom illustrations and assets' }, { at: 'stands', tone: 'info', tag: 'WHY', text: 'Stands out from the crowd in its niche' }] },
  24: { type: 'site', presence: 'hidden', cap: 'fibery-tour', from: 18.6, url: FIB, zoom: { from: FULL, to: [200, 270, 1440, 810], at: 0.2, over: 13.5 }, notes: [{ at: 0.4, tone: 'keep', tag: 'DESIGN DNA · FIBERY', text: '', kind: 'dna',
    steps: [{ at: 'warm', text: 'Warm backgrounds' }, { at: 'colors', text: 'Use of colour' }, { at: 'animated', text: 'Animated UI' }, { at: 'characters', text: 'Characters' }] }] },
  25: { type: 'site', presence: 'behind', cap: 'fibery-hero', from: 9.7, url: FIB, pins: [{ at: 0.3, x: 700, y: 175, tone: 'fix', text: '!' }],
    notes: [{ at: 0.2, tone: 'fix', tag: 'FIX', text: 'The hero title' }] },
  26: { type: 'site', presence: 'behind', cap: 'fibery-hero', from: 9.7, url: FIB, zoom: { from: FULL, to: [150, 90, 960, 540], over: 1.5 },
    rings: [{ at: 'operating', box: [297.5, 171.5, 415, 257], tone: 'ask', mark: 'headline' }],
    pins: [{ at: 0, out: 'nerds.', x: 700, y: 175, tone: 'fix', text: '!', instant: true }, { at: 'nerds.', x: 718, y: 410, tone: 'ask', text: '?' }],
    notes: [{ at: 'operating', tone: 'ask', tag: 'HEADLINE', text: '“Operating system for orgs run by nerds”' }, { at: 'average', tone: 'info', tag: 'Clear to insiders only', text: '', kind: 'contrast', cols: [{ h: 'Insiders read', t: 'An OS for nerd-run orgs. Got it.' }, { h: 'A new visitor asks', t: 'What is it? Who is it for?' }] }] },
  27: { type: 'site', presence: 'behind', cap: 'fibery-hero', from: 9.7, url: FIB, zoom: { from: [150, 90, 960, 540], to: [150, 90, 960, 540] },
    patch: { at: 'connect', box: FIB_HEAD, bg: '#FCE4CC', ink: '#1E1A17', lines: ['Connect your data.', 'Run your org.', 'Manage every task.'], label: 'Rubik concept' },
    notes: [{ at: 'actual', tone: 'keep', tag: 'SUGGESTED CHANGE', text: 'Lead with the problem it solves', kind: 'concept' }] },
  28: { type: 'verdict', site: 'Fibery', logo: 'fibery', until: 30, rows: [
    { at: 'character', tone: 'keep', text: 'A site with real character' }, { at: 'product', tone: 'keep', text: 'The product, front and centre' },
    { at: 'positioning', tone: 'fix', text: 'Sharpen the positioning and the message' }] },
  29: { type: 'cont' },
  30: { type: 'cont' },
  // ---- 02 folk
  31: { type: 'chapter', n: '02', site: 'folk', logo: 'folk', url: FOLK, of: 2 },
  32: { type: 'site', presence: 'hidden', cap: 'folk-hero', from: 0.7, to: 4.1, url: FOLK, rings: [{ at: 'CRM', box: [335.5, 245.5, 1249, 86], tone: 'keep', mark: 'hero' }],
    timer: { at: 'glance,', stop: 'CRM', text: 'Understood: a CRM' } },
  33: { type: 'site', presence: 'front', cap: 'folk-hero', from: 6.7, to: 15.8, url: FOLK, rings: [{ at: 'product', box: [240, 286, 1440, 718], tone: 'keep', mark: 'product-panel' }],
    notes: [{ at: 'clean', tone: 'keep', tag: 'KEEP', text: 'Clean hero, real product' }, { at: 'interact', tone: 'info', tag: 'INTERACTIVE', text: 'Visitors can click through the views' }] },
  34: { type: 'site', presence: 'hidden', cap: 'folk-hero', from: 27.4, to: 31.3, url: FOLK, rings: [{ at: 'social', box: [240, 466, 1440, 244], tone: 'keep', mark: 'logos' }],
    notes: [{ at: 'social', tone: 'keep', tag: 'KEEP', text: 'Social proof: logos and ratings' }, { at: 'credibility', tone: 'info', tag: 'WHY', text: 'It adds credibility' }] },
  35: { type: 'site', presence: 'hidden', beats: [{ at: 0, mark: 'journey-intro', view: [200, 160, 1520, 855] }, { at: 'entire', mark: 'find', view: [220, 30, 1480, 833] }], cap: 'folk-journey', from: 0.6, to: 5.6, rate: 1, url: FOLK, notes: [{ at: 'like', tone: 'keep', tag: 'WHAT I LIKE MOST', text: 'The whole product lifecycle, one by one' }] },
  36: { type: 'site', full: true, presence: 'hidden', beats: [{ at: 0, mark: 'find', view: [220, 30, 1480, 833] }, { at: 'open', mark: 'engage', view: [200, 60, 1520, 855] }], cap: 'folk-journey', from: 5.6, to: 12.3, url: FOLK, notes: [{ at: 'open', tone: 'keep', tag: 'KEEP', text: 'The product, wide open. Nothing to guess.' }] },
  37: { type: 'site', presence: 'hidden', beats: [{ at: 0, mark: 'find', view: [160, 0, 1600, 900] }, { at: 'engage', mark: 'engage', view: [160, 0, 1600, 900] }, { at: 'call', mark: 'call', view: [160, 0, 1600, 900] }, { at: 'AI', mark: 'know', view: [160, 0, 1600, 900] }, { at: 'close', mark: 'close', view: [160, 0, 1600, 900] }], cap: 'folk-journey', from: 12.3, to: 41.5, url: FOLK, notes: [{ at: 0.2, tone: 'keep', tag: 'ONE JOURNEY', text: '', kind: 'steps',
    steps: [{ at: 'prospect', text: 'Find' }, { at: 'engage', text: 'Engage' }, { at: 'call', text: 'Call' }, { at: 'AI', text: 'Know' }, { at: 'close', text: 'Close' }] }] },
  38: { type: 'aroll' },
  39: { type: 'maxim', lines: [
    { at: 0, text: 'Make it easy to understand.' }, { at: 'think,', text: 'No thinking.', strike: true }, { at: 'guess.', text: 'No guessing.', strike: true }, { at: 'just', text: 'They just understand.', hi: true }] },
  40: { type: 'site', presence: 'hidden', cap: 'folk-journey', from: 44.2, to: 47.0, url: FOLK, rings: [{ at: 0.2, box: [238, 349, 1442, 374], tone: 'keep', mark: 'consolidate' }],
    notes: [{ at: 'replace', tone: 'keep', tag: 'KEEP', text: 'Shows the tool stack it replaces' }] },
  41: { type: 'site', presence: 'hidden', cap: 'folk-journey', from: 50.8, to: 55.7, url: FOLK, notes: [{ at: 'testimonials,', tone: 'keep', tag: 'KEEP', text: 'Real testimonials' }, { at: 'social', tone: 'info', tag: 'WHY', text: 'Social proof always adds value' }] },
  42: { type: 'site', presence: 'behind', beats: [{ at: 0, mark: 'plans', view: [200, 100, 1520, 855] }], cap: 'folk-pricing', from: 1.4, to: 13.2, url: `${FOLK}/pricing`, notes: [{ at: 'streamlined', tone: 'keep', tag: 'PRICING', text: 'Streamlined and simple' }] },
  43: { type: 'site', presence: 'hidden', cap: 'folk-pricing', from: 13.2, url: `${FOLK}/pricing`,
    kinetic: { at: 'complex,', text: 'Complex pricing / makes people *leave.*' } },
  44: { type: 'site', presence: 'hidden', cap: 'folk-pricing', from: 13.2, to: 33.6, url: `${FOLK}/pricing`,
    rings: [{ at: 'three', out: 2.6, box: [328.5, 363.5, 404, 525], tone: 'keep', mark: 'plans' }, { at: 'simple', out: 2.6, box: [761.5, 363.5, 405, 525], tone: 'keep', mark: 'plans' }, { at: 'plans', out: 2.6, box: [1189, 358, 415, 536], tone: 'keep', mark: 'plans' }],
    notes: [{ at: 'three', tone: 'keep', tag: 'KEEP', text: 'Three simple plans' }, { at: 'comparison,', tone: 'keep', tag: 'KEEP', text: 'A full comparison below' }] },
  45: { type: 'verdict', site: 'folk', logo: 'folk', until: 47, rows: [
    { at: 'journey', tone: 'keep', text: 'The whole product journey, one step at a time' },
    { at: 'character,', tone: 'fix', text: 'Add character and branding, so it feels like folk' },
    { at: 'great', tone: 'keep', text: 'A great example of a SaaS website' }] },
  46: { type: 'cont' },
  47: { type: 'cont' },
  // ---- 03 Slite
  48: { type: 'chapter', n: '03', site: 'Slite', logo: 'slite', url: SLITE, of: 3 },
  49: { type: 'site', presence: 'behind', cap: 'slite-hero', from: 0.7, url: SLITE, zoom: { from: FULL, to: [96, 54, 1728, 972] } },
  50: { type: 'site', presence: 'behind', cap: 'slite-hero', from: 0.7, url: SLITE, zoom: { from: [96, 54, 1728, 972], to: [420, 90, 1080, 608], over: 2 },
    rings: [{ at: 'source', box: [500, 136, 920, 150], tone: 'info', mark: 'hero' }], notes: [{ at: 'say', tone: 'info', tag: 'HEADLINE', text: '“A source of truth for your team. And the AI they work with.”' }] },
  51: { type: 'site', presence: 'behind', cap: 'slite-hero', from: 0.7, url: SLITE, zoom: { from: [420, 90, 1080, 608], to: FULL, over: 1.2 },
    pins: [{ at: 'convinced', x: 1390, y: 128, tone: 'ask', text: '?' }],
    notes: [{ at: 'design', tone: 'keep', tag: 'KEEP', text: 'The look' }, { at: 'convinced', tone: 'ask', tag: '?', text: 'What does “source of truth” mean here?' }] },
  52: { type: 'aroll', tag: { at: 'clear', text: 'Say what it does, and the problem it solves' } },
  53: { type: 'site', presence: 'hidden', cap: 'slite-hero', from: 5.8, to: 8.9, url: SLITE, zoom: { from: FULL, to: [420, 440, 1080, 608], at: 'product', over: 1.4 },
    rings: [{ at: 'product', box: [519.5, 525.5, 886, 512], tone: 'keep', mark: 'hero' }],
    notes: [{ at: 'animation.', tone: 'keep', tag: 'KEEP', text: 'Real product, lightly animated' }, { at: 'glimpse', tone: 'info', tag: 'WHY', text: 'A first glimpse for people with no context' }] },
  54: { type: 'site', presence: 'hidden', cap: 'slite-tour', from: 3.0, to: 8.0, rate: 1, url: SLITE, rings: [{ at: 'logos.', box: [360, 400, 1200, 96], tone: 'keep', mark: 'logos' }],
    notes: [{ at: 'social', tone: 'keep', tag: 'KEEP', text: 'Social proof with logos' }] },
  55: { type: 'site', presence: 'front', cap: 'slite-tour', from: 11.2, to: 17.5, rate: 1, url: SLITE, notes: [{ at: 'good', tone: 'keep', tag: 'KEEP', text: 'Good sections, clear features' },
    { at: 'animations', tone: 'fix', tag: 'FIX · ADD MOTION', text: 'Static cards. A little motion gives context.', kind: 'motion' }] },
  56: { type: 'site', presence: 'hidden', beats: [{ at: 0, mark: 'agents' }, { at: 'integration', mark: 'agents', view: [300, 349, 1300, 731] }], cap: 'slite-tour', from: 42.5, to: 52.0, url: SLITE, notes: [{ at: 'integration', tone: 'keep', tag: 'KEEP', text: 'Integrations and the agents they provide' }] },
  57: { type: 'site', full: true, presence: 'hidden', beats: [{ at: 0, mark: 'use-cases' }, { at: 'use', mark: 'use-cases', view: [320, 382, 1240, 698], play: 1 }], cap: 'slite-tour', from: 24.1, to: 33.0, url: SLITE, notes: [{ at: 'use', tone: 'keep', tag: 'KEEP', text: 'Use cases with real product flows' }] },
  58: { type: 'site', presence: 'front', beats: [{ at: 0, src: 52.0 }, { at: 'testimonial', src: 54.0, view: [440, 360, 1040, 585] }], cap: 'slite-tour', from: 47.7, to: 56.2, rate: 1, url: SLITE, notes: [{ at: 'testimonial', tone: 'info', tag: 'TESTIMONIALS', text: 'Works, but easy to miss' },
    { at: 'dedicated', tone: 'fix', tag: 'SUGGESTION', text: 'Give testimonials their own section' }] },
  59: { type: 'site', presence: 'hidden', cap: 'slite-tour', from: 56.4, url: SLITE, rings: [{ at: 'pricing', box: [350, 730, 1218, 272], tone: 'keep', mark: 'pricing-glimpse' }],
    notes: [{ at: 'pricing', tone: 'keep', tag: 'KEEP', text: 'Pricing highlights on the homepage' }, { at: 'proactive', tone: 'keep', tag: 'WHY', text: 'Proactive thinking' }] },
  60: { type: 'path', until: 61 },
  61: { type: 'cont' },
  62: { type: 'site', presence: 'behind', cap: 'slite-hero', from: 1.2, url: SLITE, zoom: { from: FULL, to: [450, 295, 760, 428], at: 'CTA', over: 1.2 },
    pause: { at: 'CTA', box: SLITE_BTN } },
  63: { type: 'site', presence: 'behind', cap: 'slite-hero', from: 1.2, url: SLITE, zoom: { from: [450, 295, 760, 428], to: [450, 295, 760, 428] },
    pause: { at: 0, box: SLITE_BTN },
    notes: [{ at: 0.2, tone: 'fix', tag: 'FIX · CTA', text: '“Talk to us” = ?' }, { at: 'invite', tone: 'fix', tag: 'WHY', text: 'It doesn’t invite an action' }] },
  64: { type: 'site', presence: 'behind', cap: 'slite-hero', from: 1.2, url: SLITE, zoom: { from: [450, 295, 760, 428], to: [380, 100, 1160, 653], over: 3 },
    morph: { at: 'demo', anchor: 'right', box: [778, 407, 140, 64], from: 'Talk to us', to: 'Book a demo →', bg: '#FF6A3D', ink: '#FFFFFF' },
    notes: [{ at: 'demo', tone: 'keep', tag: 'SUGGESTED CHANGE', text: 'Say what happens when they click', kind: 'concept' }] },
  65: { type: 'verdict', site: 'Slite', logo: 'slite', until: 66, rows: [
    { at: 'elaborative', tone: 'keep', text: 'The product, explained in depth' },
    { at: 'static.', tone: 'fix', text: 'Features are static' }, { at: 'motions,', tone: 'fix', text: 'Bring them to life with motion' }] },
  66: { type: 'cont' },
  // ---- lessons, the ask, the outro
  67: { type: 'aroll', soft: true },
  68: { type: 'lessons', rules: [{ at: 'never', n: '1', text: 'Never make your users guess.', sub: 'Give them context from the first second.', sub_at: 'context',
    proof: { cap: 'fibery-hero', url: FIB, src: 9.7, ring: [297.5, 171.5, 415, 257], pin: { x: 718, y: 410, text: '?', tone: 'ask' } } }] },
  69: { type: 'aroll' },
  70: { type: 'lessons', until: 71, rules: [
    { at: 0, n: '1', text: 'Never make your users guess.', dim: true },
    { at: 'second', n: '2', text: 'Don’t hide the product.', sub: 'Show it, front and centre.', sub_at: 'center',
      proof: { cap: 'folk-hero', url: FOLK, src: 6.7, play: 1, ring: [240, 286, 1440, 718] } }] },
  71: { type: 'cont' },
  72: { type: 'aroll', cta: { at: 'websites', title: 'Want your website reviewed?', sub: 'Drop the link in the comments' } },
  73: { type: 'aroll' },
  74: { type: 'aroll', sign: true },
  75: { type: 'end' },
};

/** Holds that should not move at all (the page frozen on a mark while he reads it): capture name + from. */
export const STILLS = ['fibery-hero9.7', 'slite-hero0.7', 'slite-hero1.2', 'fibery-tour12.95', 'fibery-tour18.6'];

/** Seconds of each capture's working copy. */
export const CAP_LENGTH: Record<string, number> = {
  'fibery-hero': 15.0, 'fibery-tour': 36.9, 'folk-hero': 31.4, 'folk-journey': 55.8, 'folk-pricing': 33.6, 'slite-hero': 18.3, 'slite-tour': 61.3,
};
/** Fibery's palette, sampled from the illustration section of the capture (17 Nov 2026). */
export const FIBERY_SWATCHES = ['#FCE4CC', '#CC9C84', '#CCCCB4', '#849C9C', '#846C54'];
