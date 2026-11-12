// Throwaway local WordPress demo sites for the capture tool, built from a brand's WordPress Playground blueprint
// (brands/<brand>/product/blueprint.json) with the free WordPress Playground command-line tool, run through npx.
// The site is built fresh before Chrome opens, served on this Mac only for the take, and torn down after, so every
// take starts from the same site. A brand may instead bring its own environment (a staging or local address it names,
// signed in by hand with capture.mjs signin): see tools/capture/README.md, "WordPress demo sites".
//
// What the studio adds to the brand's blueprint, in a prepared copy (the brand's file is never changed):
//   - a small must-use plugin, written into this throwaway site only, that keeps the admin screens clean for filming
//     (other plugins' update nags off, the block editor's welcome guide closed, no "Howdy", no admin e-mail check)
//     and signs a demo user in from a link carrying this site's own random key, so nobody types or keeps a password;
//   - the demo users the blueprint lists under "users" (one per role), each with a long random password nobody sees;
//   - plugins from a local zip ("plugins": ["files/my-plugin.zip"]), unzipped and mounted, then switched on.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

// Pinned: a version at least two weeks old when this was written (12 Nov 2026), so a take made today and one made
// next month build the same tool. Change it on purpose, and test a WordPress take after.
export const PLAYGROUND_CLI = '@wp-playground/cli@3.1.61';
const FIRST_PORT = 9400;
const BOOT_LIMIT = 600; // seconds: the first build downloads the tool (about 1 GB) and WordPress once
const STUDIO_KEYS = ['users', '_about', '_notes'];

/** Which site a brand's product uses: a blueprint the studio builds, the brand's own environment, or none. */
export function siteOf(productFile, raw) {
  const dir = path.dirname(productFile);
  const site = typeof raw.site === 'string' ? { own: raw.site === 'own' } : raw.site ?? {};
  if (site.own) return { kind: 'own' };
  const named = site.blueprint ? path.resolve(dir, site.blueprint) : null;
  const found = path.join(dir, 'blueprint.json');
  const file = named ?? (fs.existsSync(found) ? found : null);
  if (!file) return null;
  return { kind: 'blueprint', file, signinAs: site.signin_as ?? 'admin', port: site.port ?? null };
}

/** The demo site's must-use plugin. Only ever written into a throwaway Playground site the studio built. */
function studioPlugin(key) {
  return `<?php
/*
 * Plugin Name: Studio capture (throwaway demo site only)
 * Description: Written by the video studio into a throwaway local WordPress Playground site that is deleted after the take. Keeps the admin screens clean for filming and signs demo users in from a link with this site's own random key. Never copy this onto a real site.
 */
if (!defined('ABSPATH')) exit;
define('STUDIO_CAPTURE_KEY', '${key}');

/* The block editor's welcome guides and the "choose a pattern" window, closed for a user. */
function studio_capture_quiet_editor($uid) {
  global $wpdb;
  $meta = $wpdb->get_blog_prefix() . 'persisted_preferences';
  $p = get_user_meta($uid, $meta, true);
  if (!is_array($p)) $p = array();
  foreach (array('core/edit-post', 'core/edit-site', 'core/edit-widgets', 'core/customize-widgets') as $scope) {
    $p[$scope] = array_merge(isset($p[$scope]) ? (array) $p[$scope] : array(), array('welcomeGuide' => false, 'welcomeGuideTemplate' => false, 'welcomeGuidePage' => false, 'welcomeGuideStyles' => false));
  }
  $p['core'] = array_merge(isset($p['core']) ? (array) $p['core'] : array(), array('enableChoosePatternModal' => false));
  $p['_modified'] = gmdate('c');
  update_user_meta($uid, $meta, $p);
}

/* Signs a demo user in from ?studio_signin=<login or role>&studio_key=<this site's key>. */
add_action('init', function () {
  if (!isset($_GET['studio_signin'])) return;
  if (!isset($_GET['studio_key']) || !hash_equals(STUDIO_CAPTURE_KEY, (string) wp_unslash($_GET['studio_key']))) { status_header(403); exit('Wrong key.'); }
  $who = sanitize_user(wp_unslash($_GET['studio_signin']), true);
  $user = get_user_by('login', $who);
  if (!$user) { $found = get_users(array('role' => $who, 'number' => 1, 'orderby' => 'ID')); $user = $found ? $found[0] : null; }
  if (!$user) { status_header(404); exit('This demo site has no user or role called ' . esc_html($who) . '.'); }
  wp_clear_auth_cookie();
  wp_set_current_user($user->ID);
  wp_set_auth_cookie($user->ID, false);
  studio_capture_quiet_editor($user->ID);
  nocache_headers();
  header('Content-Type: text/plain; charset=utf-8');
  exit('Signed in as ' . $user->user_login . ' (' . implode(', ', $user->roles) . ').');
}, 1);

/* Clean screen: no update nags or counts, no admin e-mail check, no automatic updates, no "Howdy". */
$studio_capture_nothing_new = function () { return (object) array('last_checked' => time(), 'version_checked' => get_bloginfo('version'), 'updates' => array(), 'response' => array(), 'translations' => array(), 'no_update' => array()); };
add_filter('pre_site_transient_update_core', $studio_capture_nothing_new);
add_filter('pre_site_transient_update_plugins', $studio_capture_nothing_new);
add_filter('pre_site_transient_update_themes', $studio_capture_nothing_new);
add_filter('automatic_updater_disabled', '__return_true');
add_filter('admin_email_check_interval', '__return_zero');
add_action('admin_init', function () {
  remove_action('admin_notices', 'update_nag', 3);
  remove_action('admin_notices', 'maintenance_nag', 10);
  if (get_current_user_id()) {
    global $wpdb;
    $p = get_user_meta(get_current_user_id(), $wpdb->get_blog_prefix() . 'persisted_preferences', true);
    if (!is_array($p) || !isset($p['core/edit-post']['welcomeGuide'])) studio_capture_quiet_editor(get_current_user_id());
  }
});
add_action('admin_bar_menu', function ($bar) {
  $node = $bar->get_node('my-account');
  if (!$node) return;
  $bar->add_node(array('id' => 'my-account', 'title' => preg_replace('/^.*?(<span class="display-name">)/s', '$1', $node->title)));
}, 9999);
`;
}

/** A prepared copy of the brand's blueprint, with the studio's parts added. Returns what to start Playground with. */
export function prepareBlueprint(file, workDir, key, stop) {
  let bp;
  try { bp = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { stop(`${file} is not valid JSON: ${e.message}`); }
  if (!bp || typeof bp !== 'object' || Array.isArray(bp)) stop(`${file} must be a WordPress Playground blueprint: { "preferredVersions": ..., "plugins": [...], "steps": [...] }.`);
  const dir = path.dirname(file);
  const copy = { ...bp };
  for (const k of STUDIO_KEYS) delete copy[k];
  const mounts = [];
  const activate = [];
  // Plugins from a local zip: unzipped into the work folder and mounted into the site, then switched on.
  if (Array.isArray(copy.plugins)) {
    copy.plugins = copy.plugins.filter((p) => {
      if (typeof p !== 'string' || !/\.zip$/i.test(p) || /^https?:/i.test(p)) return true;
      const zip = path.resolve(dir, p);
      if (!fs.existsSync(zip)) stop(`${file}: the plugin zip ${zip} is missing.`);
      const out = path.join(workDir, 'plugins', path.basename(zip, '.zip'));
      fs.mkdirSync(out, { recursive: true });
      const r = spawnSync('unzip', ['-q', '-o', zip, '-d', out], { encoding: 'utf8' });
      if (r.status !== 0) stop(`Could not unzip ${zip}: ${(r.stderr || '').trim()}`);
      // A plugin zip usually holds one folder named after the plugin; a zip of loose files is the plugin itself.
      const inside = fs.readdirSync(out).filter((f) => !f.startsWith('.') && f !== '__MACOSX');
      const root = inside.length === 1 && fs.statSync(path.join(out, inside[0])).isDirectory() ? path.join(out, inside[0]) : out;
      const name = path.basename(root);
      mounts.push(`${root}:/wordpress/wp-content/plugins/${name}`);
      activate.push({ step: 'activatePlugin', pluginPath: `/wordpress/wp-content/plugins/${name}` });
      return false;
    });
  }
  // Demo users, one per role, each with a long random password nobody sees: the take signs them in with the link.
  const users = Array.isArray(bp.users) ? bp.users : [];
  users.forEach((u, i) => {
    if (!u || typeof u.login !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/i.test(u.login) || typeof u.role !== 'string') stop(`${file}: "users" item ${i + 1} needs "login" (one word) and "role" (a WordPress role, like "editor" or "customer"), like { "login": "vendor", "role": "editor", "name": "Ana Ruiz" }.`);
    if (/pass/i.test(Object.keys(u).join(' '))) stop(`${file}: "users" item ${i + 1} has a password. Leave it out: the demo site makes a random one nobody sees, and the take signs the user in by itself.`);
  });
  const userPhp = users.length ? `<?php
require '/wordpress/wp-load.php';
foreach (json_decode(${JSON.stringify(JSON.stringify(users.map((u) => ({ login: u.login, role: u.role, name: u.name ?? u.login, email: u.email ?? `${u.login}@example.test` }))))}, true) as $u) {
  if (username_exists($u['login'])) continue;
  $id = wp_insert_user(array('user_login' => $u['login'], 'user_pass' => wp_generate_password(40, true, true), 'role' => $u['role'], 'display_name' => $u['name'], 'first_name' => strtok($u['name'], ' '), 'user_email' => $u['email']));
  if (is_wp_error($id)) throw new Exception($id->get_error_message());
}
` : null;
  copy.steps = [
    { step: 'writeFile', path: '/wordpress/wp-content/mu-plugins/studio-capture.php', data: studioPlugin(key) },
    ...activate,
    ...(Array.isArray(bp.steps) ? bp.steps : []),
    ...(userPhp ? [{ step: 'runPHP', code: userPhp }] : []),
  ];
  const prepared = path.join(workDir, 'blueprint.prepared.json');
  fs.writeFileSync(prepared, JSON.stringify(copy, null, 2) + '\n');
  const v = bp.preferredVersions ?? {};
  return { prepared, mounts, php: v.php, wp: v.wp, users: users.map((u) => `${u.login} (${u.role})`), plugins: [...(bp.plugins ?? []).map((p) => (typeof p === 'string' ? p : p?.slug ?? p?.pluginData?.slug ?? 'a plugin'))] };
}

/** The first free port from 9400 on, on this Mac. */
async function freePort(from = FIRST_PORT) {
  for (let p = from; p < from + 200; p++) {
    const ok = await new Promise((resolve) => {
      const s = net.createServer();
      s.once('error', () => resolve(false));
      s.listen(p, '127.0.0.1', () => s.close(() => resolve(true)));
    });
    if (ok) return p;
  }
  return null;
}

/**
 * Builds the brand's demo site and serves it on this Mac. Returns { address, signinUrl(role), stop() }.
 * `say` and `stop` are the capture tool's own.
 */
export async function startSite({ site, studio, brand, say, stop, quiet = false }) {
  const work = path.join(studio, '.capture', brand, 'site');
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const key = randomBytes(16).toString('hex');
  const bp = prepareBlueprint(site.file, work, key, stop);
  const port = site.port ?? await freePort();
  if (!port) stop('No free port between 9400 and 9600 on this Mac for the demo site.');
  const address = `http://127.0.0.1:${port}`;
  const args = ['--yes', PLAYGROUND_CLI, 'server', `--blueprint=${bp.prepared}`, `--port=${port}`, `--site-url=${address}`, '--verbosity=normal'];
  if (bp.php) args.push(`--php=${bp.php}`);
  if (bp.wp) args.push(`--wp=${bp.wp}`);
  for (const m of bp.mounts) args.push(`--mount=${m}`);
  const cache = path.join(studio, '.capture', 'npm-cache');
  fs.mkdirSync(cache, { recursive: true });
  const first = !fs.existsSync(path.join(cache, '_npx'));
  say(`Building the demo site from ${path.relative(studio, site.file)} (WordPress ${bp.wp ?? 'latest'}, PHP ${bp.php ?? '8.3'}${bp.plugins.length ? `, plugins: ${bp.plugins.join(', ')}` : ''}${bp.users.length ? `, demo users: ${bp.users.join(', ')}` : ''})...`);
  if (first) say('  the first time on this Mac it downloads WordPress Playground (about 1 GB, kept in .capture/npm-cache) and WordPress; later builds take under a minute');
  const log = fs.openSync(path.join(work, 'playground.log'), 'w');
  const child = spawn('npx', args, { cwd: work, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, npm_config_cache: cache, npm_config_update_notifier: 'false', npm_config_fund: 'false', NODE_NO_WARNINGS: '1' } });
  let out = '';
  const take = (b) => { const s = b.toString(); out += s; fs.writeSync(log, s); };
  child.stdout.on('data', take);
  child.stderr.on('data', take);
  let exited = null;
  child.on('exit', (code, signal) => { exited = { code, signal }; });
  const kill = () => { try { process.kill(-child.pid, 'SIGTERM'); } catch {} };
  // The site never outlives the tool: Ctrl+C, a stop or a crash all take it down.
  process.once('exit', kill);
  const t0 = Date.now();
  while (!/Ready!.*running on/i.test(out)) {
    if (exited) {
      const why = out.split('\n').map((l) => l.trim()).filter((l) => l && !/EBADENGINE|required:|current:|package:|^}$|trust settings|deprecated/i.test(l)).slice(-4).join(' ');
      if (/EPERM|operation not permitted/i.test(out)) stop(`The demo site could not open its port on this Mac (${why}). Something here blocks local servers; if you run the studio inside a sandbox, allow local connections for this command.`);
      stop(`The demo site could not be built: ${why || `the tool stopped (${exited.code ?? exited.signal})`}. Its full log: ${path.relative(studio, path.join(work, 'playground.log'))}`);
    }
    if ((Date.now() - t0) / 1000 > BOOT_LIMIT) { kill(); stop(`The demo site was not ready after ${BOOT_LIMIT / 60} minutes. Its log: ${path.relative(studio, path.join(work, 'playground.log'))}`); }
    await new Promise((r) => setTimeout(r, 250));
  }
  const seconds = ((Date.now() - t0) / 1000).toFixed(1);
  if (!quiet) say(`  demo site ready at ${address} in ${seconds} s (on this Mac only for this take; it is torn down after)`);
  const stopSite = async () => {
    if (exited) return;
    kill();
    for (let i = 0; i < 40 && !exited; i++) await new Promise((r) => setTimeout(r, 100));
    if (!exited) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
    process.removeListener('exit', kill);
    fs.closeSync(log);
  };
  return {
    address,
    port,
    seconds: Number(seconds),
    built_from: path.relative(studio, site.file),
    tool: PLAYGROUND_CLI,
    wordpress: bp.wp ?? 'latest',
    php: bp.php ?? '8.3',
    users: bp.users,
    plugins: bp.plugins,
    signinAs: site.signinAs,
    signinUrl: (who) => `${address}/?studio_signin=${encodeURIComponent(who)}&studio_key=${key}`,
    stop: stopSite,
  };
}

/** Whether WordPress Playground has been fetched on this Mac yet (for the health check). */
export function playgroundCached(studio) {
  const dir = path.join(studio, '.capture', 'npm-cache', '_npx');
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).some((d) => fs.existsSync(path.join(dir, d, 'node_modules', '@wp-playground', 'cli')));
}
