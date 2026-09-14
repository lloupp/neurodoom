import assert from 'node:assert/strict';
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

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:4173');
      if (response.ok) return;
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`preview server did not become ready\n${serverOutput}`);
}

try {
  await waitForServer();

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    // Pointer lock is intentionally irrelevant to this regression and is not
    // consistently available in headless Chromium. Stub it before app boot.
    await page.addInitScript(() => {
      Element.prototype.requestPointerLock = function requestPointerLock() {};
      document.exitPointerLock = function exitPointerLock() {};
    });

    await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
    await page.locator('#boot').waitFor({ state: 'visible' });
    assert.equal(await page.locator('canvas').count(), 3, 'render canvases must mount');
    assert.equal(await page.locator('[data-act="newgame"]').isVisible(), true, 'new game must be available');

    // Seed a real IndexedDB save in Level 2. The historical bug rebuilt Level 1
    // while continuing and autosaved that spawn state over this record.
    await page.evaluate(async () => {
      const request = indexedDB.open('neurodoom', 1);
      const db = await new Promise((resolve, reject) => {
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('saves')) request.result.createObjectStore('saves');
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put({
        schema_version: 1,
        saved_at: Date.now(),
        play_time_ms: 123456,
        data: {
          px: 6.5,
          py: 6.5,
          angle: 1.25,
          pitch: 0.1,
          fov: 1.05,
          stats: { hp: 73, maxHp: 100, stamina: 61, maxStamina: 100, credits: 42 },
          weapon: 'shotgun',
          ammo: { pistol: 12, shotgun: 5, pulse_rifle: 18, rocket_launcher: 2 },
          inventory: ['keycard:test'],
          flags: ['story:test'],
          level: 'sector_9',
          time: 123456,
        },
      }, 'neurodoom:save:0');

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
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
    await page.waitForTimeout(300);

    const record = await page.evaluate(async () => {
      const request = indexedDB.open('neurodoom', 1);
      const db = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = db.transaction('saves', 'readonly');
      const get = tx.objectStore('saves').get('neurodoom:save:0');
      const result = await new Promise((resolve, reject) => {
        get.onsuccess = () => resolve(get.result);
        get.onerror = () => reject(get.error);
      });
      db.close();
      return result;
    });

    assert.equal(record.data.level, 'sector_9', 'Continue must preserve the saved level');
    assert.equal(record.data.px, 6.5, 'Continue must preserve the saved X position');
    assert.equal(record.data.py, 6.5, 'Continue must preserve the saved Y position');
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
} finally {
  stopServer();
}
