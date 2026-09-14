import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';

const previewPath = process.env.E2E_PATH ?? '/';
const previewUrl = new URL(previewPath, 'http://127.0.0.1:4173').toString();

const server = await preview({
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
});

async function readSave(page) {
  return page.evaluate(async () => {
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
}

try {
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

    await page.goto(previewUrl, { waitUntil: 'networkidle' });
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

    assert.match(
      await page.locator('[data-weapon-name]').innerText(),
      /HX DISRUPTOR/,
      'Continue must restore the saved weapon',
    );
    assert.match(
      await page.locator('[data-weapon-ammo]').innerText(),
      /^5\s*\/\s*0$/,
      'Continue must restore the saved weapon ammo',
    );

    const continuedSave = await readSave(page);
    assert.equal(continuedSave.data.level, 'sector_9', 'Continue must preserve the saved level');
    assert.equal(continuedSave.data.px, 6.5, 'Continue must preserve the saved X position');
    assert.equal(continuedSave.data.py, 6.5, 'Continue must preserve the saved Y position');
    assert.equal(continuedSave.data.weapon, 'shotgun', 'Continue must not overwrite the saved weapon');
    assert.deepEqual(continuedSave.data.flags, ['story:test'], 'Continue must preserve saved world flags');

    // Exercise the second lifecycle edge: Continue -> pause -> Main Menu -> New Run.
    // A fresh run must not inherit any state from the continued session and must
    // restart simulation even though Main Menu was entered from a paused game.
    await page.keyboard.press('Escape');
    const mainMenuButton = page.locator('[data-act="mainmenu"]');
    await mainMenuButton.waitFor({ state: 'visible' });
    await mainMenuButton.click();
    await page.locator('#boot').waitFor({ state: 'visible' });
    await page.locator('[data-act="newgame"]').click();
    await page.locator('#hud').waitFor({ state: 'visible' });
    await page.waitForTimeout(500);

    assert.match(
      await page.locator('[data-weapon-name]').innerText(),
      /VANBRCK-7 PISTOL/i,
      'New Run must reset the active weapon',
    );
    assert.match(
      await page.locator('[data-weapon-ammo]').innerText(),
      /^36\s*\/\s*0$/,
      'New Run must reset weapon ammo',
    );

    const newRunSave = await readSave(page);
    assert.equal(newRunSave.data.level, 'sublevel_3', 'New Run must restart at the first level');
    assert.equal(newRunSave.data.weapon, 'pistol', 'New Run must persist the default weapon');
    assert.equal(newRunSave.data.stats.credits, 0, 'New Run must reset credits');
    assert.deepEqual(newRunSave.data.inventory, [], 'New Run must clear inventory');
    assert.deepEqual(newRunSave.data.flags, [], 'New Run must clear world flags');
    assert.ok(newRunSave.data.time < 1000, 'New Run must reset accumulated play time');

    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
} finally {
  await new Promise((resolve, reject) => {
    server.httpServer.close((error) => error ? reject(error) : resolve());
  });
}
