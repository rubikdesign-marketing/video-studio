// Text moves (LIBRARY-PLAN phase 4): film type that arrives, types, decodes, is emphasised, lays itself out and
// leaves. Every move is a pure function of the scene clock, uses the brand's type and colours, fits all four frame
// sizes through the shared splitter, and names the sound it wants in library/motion/index.json.
export { asLines, pieceGap, useTextClock, type TextMoveProps } from './core';
export { lastRank, MAX_WIDTH, rankOf, splitText, SplitText, textWidth, useFitSize, type LineColour, type Order, type Piece, type Unit } from './split';

// Arrivals, soft
export { BlockReveal } from './BlockReveal';
export { BlurSweep } from './BlurSweep';
export { FadeUp } from './FadeUp';
export { FocusIn } from './FocusIn';
export { GiantCrop } from './GiantCrop';
export { LetterCascade } from './LetterCascade';
export { MaskRise, maskRiseEnds } from './MaskRise';
export { OutlineFill } from './OutlineFill';
export { SoftWipe } from './SoftWipe';

// Arrivals, bold
export { ArcSwing } from './ArcSwing';
export { DropBounce } from './DropBounce';
export { FlipUp } from './FlipUp';
export { FromLens } from './FromLens';
export { ScatterAssemble } from './ScatterAssemble';
export { Slam } from './Slam';
export { SmearIn } from './SmearIn';
export { WordPop } from './WordPop';

// Typing and decode
export { Anagram } from './Anagram';
export { DrumRoll } from './DrumRoll';
export { GlitchIn } from './GlitchIn';
export { HumanType } from './HumanType';
export { PixelDecode } from './PixelDecode';
export { Retype } from './Retype';
export { ScrambleLock } from './ScrambleLock';
export { SplitFlap } from './SplitFlap';
export { StreamAnswer } from './StreamAnswer';

// Emphasis
export { ColourFront } from './ColourFront';
export { GradientInk } from './GradientInk';
export { Highlighter } from './Highlighter';
export { LetterWave } from './LetterWave';
export { MarkWord } from './MarkWord';
export { PayoffPunch } from './PayoffPunch';
export { Shimmer } from './Shimmer';
export { VoiceSwap } from './VoiceSwap';
export { WeightWave } from './WeightWave';

// Layout, captions and exits
export { CaptionBox, groupPhrases } from './CaptionBox';
export { CaptionPop } from './CaptionPop';
export { ExitSet } from './ExitSet';
export { MakeRoom } from './MakeRoom';
export { OneWordStack } from './OneWordStack';
export { OnPath } from './OnPath';
export { RecentreBuild, recentreBuildEnds } from './RecentreBuild';
export { TextWindow, textWindowOpens } from './TextWindow';
export { Ticker } from './Ticker';
export { WordMorph } from './WordMorph';
