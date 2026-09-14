import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
const replaceOnce = (text, from, to, label) => {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return text.replace(from, to);
};

// 1) Fix Continue/save corruption: loading a save must not autosave the spawn state,
// and starting the runtime after load must not force Level 1 again.
{
  const p = 'src/game/index.ts';
  let s = read(p);
  s = replaceOnce(
    s,
    `  begin(): void {\n    this.hasWon = false;\n    this.refs.win.hidden = true;\n    this.lastHp = this.player.stats.hp;\n    this.lastZoneName = null;\n    this.bossIntroShown = false;\n    this.muzzle = 0;\n    this.runStats = { kills: 0, shots: 0, hits: 0 };\n    this.fx.bossBar(null);\n    this.loadLevelById('sublevel_3');\n    this.shell.start({`,
    `  begin(levelId: string | null = 'sublevel_3'): void {\n    this.hasWon = false;\n    this.refs.win.hidden = true;\n    this.lastHp = this.player.stats.hp;\n    this.lastZoneName = null;\n    this.bossIntroShown = false;\n    this.muzzle = 0;\n    this.runStats = { kills: 0, shots: 0, hits: 0 };\n    this.fx.bossBar(null);\n    if (levelId !== null && !this.loadLevelById(levelId)) {\n      throw new Error(\`Unknown start level: \${levelId}\`);\n    }\n    this.shell.start({`,
    'begin level selection',
  );
  s = replaceOnce(s, `  loadLevelById(id: string): boolean {`, `  loadLevelById(id: string, autosave = true): boolean {`, 'loadLevel signature');
  s = replaceOnce(
    s,
    `    this.firedTriggers.clear();\n    void this.save();\n    return true;\n  }`,
    `    this.firedTriggers.clear();\n    if (autosave) void this.save();\n    return true;\n  }`,
    'level autosave guard',
  );
  s = replaceOnce(
    s,
    `    this.loadLevelById(data.level);\n    this.player.position = { x: data.px, y: data.py };`,
    `    if (!this.loadLevelById(data.level, false)) return false;\n    this.player.position = { x: data.px, y: data.py };`,
    'load without overwrite',
  );
  s = replaceOnce(
    s,
    `        await this.load();\n        this.input.requestPointerLock();\n        this.begin();\n        this.startMenuAudio();`,
    `        const loaded = await this.load();\n        if (!loaded) return;\n        this.input.requestPointerLock();\n        this.begin(null);\n        this.startMenuAudio();`,
    'continue runtime start',
  );
  write(p, s);
}

// 2) Dependency/security gates and browser smoke test.
{
  const p = 'package.json';
  const pkg = JSON.parse(read(p));
  pkg.scripts.audit = 'npm audit --audit-level=high';
  pkg.scripts['test:e2e'] = 'node scripts/e2e-smoke.mjs';
  pkg.devDependencies.vitest = '^3.2.5';
  pkg.engines.node = '>=22';
  write(p, `${JSON.stringify(pkg, null, 2)}\n`);
}

write('scripts/e2e-smoke.mjs', `import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const server = spawn(npm, ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk; });
server.stderr.on('data', (chunk) => { serverOutput += chunk; });

const stopServer = () => {
  if (!server.killed) server.kill('SIGTERM');
};
process.on('exit', stopServer);

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch('http://127.0.0.1:4173');
      if (res.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(\`preview server did not become ready\\n\${serverOutput}\`);
}

await waitForServer();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const runtimeErrors = [];
page.on('pageerror', (err) => runtimeErrors.push(\`pageerror: \${err.message}\`));
page.on('console', (msg) => {
  if (msg.type() === 'error') runtimeErrors.push(\`console: \${msg.text()}\`);
});

try {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
  await page.locator('#boot').waitFor({ state: 'visible' });
  assert.equal(await page.locator('canvas').count(), 3, 'three render canvases should mount');
  assert.equal(await page.locator('[data-act="newgame"]').isVisible(), true, 'new game must be visible');

  // Seed a realistic Level 2 save. Continue must preserve this record instead of
  // overwriting it with Level 1 spawn data while reconstructing runtime systems.
  await page.evaluate(async () => {
    const req = indexedDB.open('neurodoom', 1);
    const db = await new Promise((resolve, reject) => {
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('saves')) req.result.createObjectStore('saves');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction('saves', 'readwrite');
    tx.objectStore('saves').put({
      schema_version: 1,
      saved_at: Date.now(),
      play_time_ms: 123456,
      data: {
        px: 6.5, py: 6.5, angle: 1.25, pitch: 0.1, fov: 1.05,
        stats: { hp: 73, maxHp: 100, stamina: 61, maxStamina: 100, credits: 42 },
        weapon: 'shotgun',
        ammo: { pistol: 12, shotgun: 5, pulse_rifle: 18, rocket_launcher: 2 },
        inventory: ['keycard:test'], flags: ['story:test'], level: 'sector_9', time: 123456,
      },
    }, 'neurodoom:save:0');
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  });

  await page.reload({ waitUntil: 'networkidle' });
  const continueButton = page.locator('[data-act="continue"]');
  await continueButton.waitFor({ state: 'visible' });
  await continueButton.click();
  await page.locator('#hud').waitFor({ state: 'visible' });
  await page.waitForTimeout(250);

  const saved = await page.evaluate(async () => {
    const req = indexedDB.open('neurodoom', 1);
    const db = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction('saves', 'readonly');
    const get = tx.objectStore('saves').get('neurodoom:save:0');
    const record = await new Promise((resolve, reject) => {
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
    });
    db.close();
    return record;
  });

  assert.equal(saved.data.level, 'sector_9', 'Continue must not overwrite the saved level');
  assert.equal(saved.data.px, 6.5, 'Continue must not overwrite the saved position');
  assert.equal(runtimeErrors.length, 0, runtimeErrors.join('\\n'));
} finally {
  await browser.close();
  stopServer();
}
`);

// 3) Harden standard CI and Android release quality gates; remove deprecated Node20-based action majors.
{
  const p = '.github/workflows/ci.yml';
  let s = read(p).replaceAll('actions/checkout@v4', 'actions/checkout@v7').replaceAll('actions/setup-node@v4', 'actions/setup-node@v7');
  s = replaceOnce(s, `      - run: npm ci\n      - run: npm run lint`, `      - run: npm ci\n      - run: npm run audit\n      - run: npm run lint`, 'CI audit gate');
  s = replaceOnce(s, `      - run: npm run build\n`, `      - run: npm run build\n      - run: npx playwright install --with-deps chromium\n      - run: npm run test:e2e\n`, 'CI e2e gate');
  write(p, s);
}

{
  const p = '.github/workflows/android-release.yml';
  let s = read(p).replaceAll('actions/checkout@v4', 'actions/checkout@v7').replaceAll('actions/setup-node@v4', 'actions/setup-node@v7');
  s = replaceOnce(s, `          npm run lint\n          npm run typecheck`, `          npm run audit\n          npm run lint\n          npm run typecheck`, 'Android audit gate');
  write(p, s);
}

// 4) Documentation must match the actual shipping product (touch + Android already exist).
{
  const p = 'README.md';
  let s = read(p);
  s = s.replace('Click anywhere — pointer-lock engages. WASD + mouse look.', 'Desktop: click anywhere — pointer-lock engages. WASD + mouse look. On touch devices, on-screen movement/look/action controls are mounted automatically.');
  s = s.replace('Multiplayer, mobile/touch, WebGL, online leaderboards. v0.2 territory.', 'Multiplayer, WebGL/WebGPU, online leaderboards, and mod tooling beyond typed manifests. Android/touch support is already present through Capacitor + on-screen controls.');
  write(p, s);
}

{
  const p = 'SPEC.md';
  let s = read(p);
  s = s.replace('- Mobile / touch input\n', '');
  s = s.replace('These are *intentional*. The vertical slice proves the core; expansion comes in v0.2.', 'These are *intentional*. The vertical slice proves the core; Android/touch support has since graduated into the current build via Capacitor and on-screen controls.');
  write(p, s);
}

console.log('Gauntlet patch staged successfully.');
