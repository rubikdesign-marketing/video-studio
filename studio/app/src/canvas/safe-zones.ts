/**
 * Where each app covers a tall (9:16) film with its own buttons and text.
 * Every number is a share of the frame, so it scales with the picture. The pixel figures quoted are on 1080 x 1920.
 *
 * All three are the platforms' margins for ads, which are the strictest ones they publish. A post that is not an ad
 * is covered a little less, so these are safe for both.
 *
 * Taken on 18 November 2026.
 */

export type Platform = 'reels' | 'tiktok' | 'shorts';

export interface SafeZone {
  name: string;
  /** Share of the frame covered at each edge. */
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** A wider strip down the right for the app's buttons: it starts `from` (share of the height) and runs to the bottom margin. */
  buttons?: { from: number; right: number };
  source: string;
  /** How far to trust the numbers. */
  confidence: 'high' | 'medium';
  note: string;
}

export const SAFE_ZONES: Record<Platform, SafeZone> = {
  reels: {
    name: 'Reels',
    top: 0.14,
    bottom: 0.35,
    left: 0.06,
    right: 0.06,
    source: 'Meta Ads Guide, Instagram Reels design recommendations (facebook.com/business/ads-guide)',
    confidence: 'high',
    note: 'Meta states the shares itself: about 14% at the top, 35% at the bottom and 6% on each side.',
  },
  tiktok: {
    name: 'TikTok',
    top: 240 / 1920,
    bottom: 660 / 1920,
    left: 120 / 1080,
    right: 120 / 1080,
    buttons: { from: 840 / 1920, right: 300 / 1080 },
    source: 'TikTok Ads help, In-Feed Ads safe zone file, as read and scaled to 1080 x 1920 by clear-cortex.com and socialync.io',
    confidence: 'medium',
    note: 'TikTok publishes a template file drawn at 720 x 1280, not numbers. These are that file scaled by 1.5, as two independent guides report it. The file itself was not opened here.',
  },
  shorts: {
    name: 'Shorts',
    top: 288 / 1920,
    bottom: 672 / 1920,
    left: 48 / 1080,
    right: 192 / 1080,
    source: "Google's guide to vertical video ads on YouTube, as quoted by markstudios.com and softphoria.com",
    confidence: 'medium',
    note: "Google's reference image marks 288, 672, 48 and 192 pixels. Read from two guides that quote it, not from Google's page itself.",
  },
};

export const PLATFORMS: Platform[] = ['reels', 'tiktok', 'shorts'];

/**
 * Title-safe: the middle 90% of the frame, a 5% margin on every side.
 * Source: SMPTE ST 2046-1 and EBU R 95 safe areas for 16:9 pictures. Confidence: high.
 */
export const TITLE_SAFE_MARGIN = 0.05;
