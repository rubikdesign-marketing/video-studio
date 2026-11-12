// Product-kind presets for the capture tool: one word in a brand's capture.json ("kind": "ai product") fills sensible
// clean-screen, wait, privacy and page-size defaults for that kind of product. Whatever the brand or the script sets
// itself always wins; lists (things to hide, pop-ups to dismiss, never-show rules, background requests) are added to
// the brand's own. See tools/capture/README.md, "Product kinds", and CAPTURE-PLAN.md section 2.

// Test card numbers payment providers publish (Stripe, Braintree, Adyen): fine to show; any other card number stops
// the take.
const TEST_CARDS = ['4242424242424242', '4242 4242 4242 4242', '4000056655665556', '4000 0566 5566 5556', '5555555555554444', '5555 5555 5555 4444', '378282246310005', '3782 822463 10005', '4111111111111111', '4111 1111 1111 1111'];

export const KINDS = {
  'web app': {
    about: 'A web app: boards, tables, dashboards, editors. Desktop page, the usual waits.',
    size: 'desktop',
  },
  'ai product': {
    about: 'A web product that writes answers with AI. Longer waits, AI answers recorded once and replayed for retakes.',
    size: 'desktop',
    ready_limit: 30,
    settle_limit: 6,
    // "wait for stopped": how long the text must stay the same, and the longest an answer may take.
    stopped: { quiet: 1.5, limit: 90 },
    // The product's own calls whose answers are recorded once and replayed (paths on the product's site). A brand
    // names its own in "ai": { "answers": [...] }.
    answers: ['/api/'],
  },
  wordpress: {
    about: 'A WordPress plugin, in a demo site. Other plugins\' notices and update nags hidden, the block editor\'s welcome guide closed, the WordPress sign-in page known.',
    size: 'desktop',
    ready_limit: 30,
    hide: [
      { what: 'WordPress admin notices (other plugins, updates)', selector: '#wpbody-content > .notice, #wpbody-content > .updated, #wpbody-content > .update-nag, #wpbody-content > .error, .wrap > .notice, .wrap > .update-nag, #wpbody-content .update-message' },
      { what: 'WordPress update counts in the menu', selector: '#wp-admin-bar-updates, .update-plugins, .awaiting-mod' },
      { what: 'WordPress footer version line', selector: '#footer-upgrade' },
    ],
    dismiss: [
      { what: 'Block editor welcome guide', press: 'Escape', when: 'Welcome to the block editor', wait: 2 },
    ],
    // The block editor fills the window on purpose (WordPress's full-screen editing): it is the product, not a cover.
    keep: [
      { what: 'The block editor (full screen)', selector: '.interface-interface-skeleton, .block-editor__container' },
    ],
    never_show: [
      { what: 'WordPress update and site-health pages', paths: ['/wp-admin/update-core.php', '/wp-admin/site-health.php'] },
    ],
    signin_paths: ['/wp-login.php', '/login'],
    background: ['admin-ajax.php', 'wp-cron.php', '/wp-json/wp/v2/users/me', 'heartbeat'],
  },
  shop: {
    about: 'An online shop (WooCommerce, a Shopify app). Test-mode payments only: any card number that is not a published test card stops the take.',
    size: 'desktop',
    ready_limit: 25,
    never_show: [
      { what: 'Real card numbers (only a payment provider\'s published test cards may show)', pattern: '\\b(?:\\d[ -]?){13,19}\\b', allow: TEST_CARDS },
    ],
    background: ['js.stripe.com/v3/m-outer', 'm.stripe.com', 'paypal.com/xoplatform/logger', 'shop.app/pay/session'],
  },
  extension: {
    about: 'A Chrome extension. The studio\'s own Chrome window loads it from a folder; its popup or side panel opens as a page in its own tab at its real size.',
    size: 'desktop',
    browser: 'studio',
  },
  'phone web': {
    about: 'The phone version of a web product: a phone-size page with touch on (touch events, no hover, a phone browser\'s identity). Taps and swipes are logged for the engine\'s touch pointer.',
    size: 'phone',
    touch: true,
  },
  desktop: {
    about: 'A desktop app built with Electron. Launched from "app": { "path": ... } (the .app, or its source folder) and its window recorded like a page, at its own size unless "size" says otherwise. Native Mac apps are not Electron: record those by hand with Cap.',
    recorder: 'desktop',
    size: 'app',
  },
  'phone app': {
    about: 'A phone app, in the iOS Simulator (needs Xcode; taps need idb) or the Android emulator (needs Android Studio). Steps: open, tap, type, swipe, press, wait, wait for, mark. The status bar is cleaned to 9:41.',
    recorder: 'simulator',
    size: 'phone',
    touch: true,
  },
  'command line': {
    about: 'A command-line tool. The commands in the script run for real in a folder of their own, and the studio draws the terminal at double sharpness (no VHS needed). Steps: run, type, press Enter, wait, wait for, clear, mark.',
    recorder: 'terminal',
  },
};

const ALIASES = {
  web: 'web app', webapp: 'web app', app: 'web app', 'work app': 'web app', saas: 'web app',
  ai: 'ai product', 'ai web product': 'ai product', 'ai app': 'ai product',
  wp: 'wordpress', 'wordpress plugin': 'wordpress', 'wordpress site': 'wordpress',
  'online shop': 'shop', store: 'shop', woocommerce: 'shop', 'shopify app': 'shop',
  'browser extension': 'extension', 'chrome extension': 'extension',
  'mobile web': 'phone web', 'phone-web': 'phone web', mobile: 'phone web',
  electron: 'desktop', 'desktop app': 'desktop',
  'mobile app': 'phone app', ios: 'phone app', android: 'phone app', 'native app': 'phone app',
  cli: 'command line', terminal: 'command line', 'command-line': 'command line',
};

/** The preset a kind names ("AI product", "ai-product", "wp" ...), or null for none. Unknown words: an error message. */
export function kindOf(word) {
  if (word === undefined || word === null || word === '') return { name: null, preset: {} };
  const key = String(word).toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  const name = KINDS[key] ? key : ALIASES[key];
  if (!name) return { error: `"${word}" is not a product kind the capture tool knows. Use one of: ${Object.keys(KINDS).join(', ')}.` };
  return { name, preset: KINDS[name] };
}

/** One line per kind, for the help text and the README. */
export const KIND_LIST = Object.entries(KINDS).map(([k, v]) => `  ${k.padEnd(13)} ${v.about}`).join('\n');
