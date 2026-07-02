import './style.css';
import { installGlobalErrorLogging, TouchControls, isTouchDevice } from './engine';
import { Game } from './game';

installGlobalErrorLogging();

const root = document.getElementById('root')!;

const worldCanvas   = document.createElement('canvas');
worldCanvas.id = 'canvas-world';

const spriteCanvas  = document.createElement('canvas');
spriteCanvas.id = 'canvas-sprites';

const weaponCanvas  = document.createElement('canvas');
weaponCanvas.id = 'canvas-weapon';

// FX overlays
const fxScan = document.createElement('div');  fxScan.id = 'fx-scanlines';
const fxVig  = document.createElement('div');  fxVig.id  = 'fx-vignette';
const fxChrom = document.createElement('div'); fxChrom.id = 'fx-chroma';

// HUD
const hud = document.createElement('div');
hud.id = 'hud';
hud.hidden = true;
hud.innerHTML = `
  <div id="hud-top">
    <div class="hud-cell hud-vitals">
      <div class="bar"><label>HP</label><div class="bar-track" data-bar="hp"><span></span></div><span class="bar-value" data-display="hp">100</span></div>
      <div class="bar"><label>STA</label><div class="bar-track" data-bar="stamina"><span></span></div><span class="bar-value" data-display="stamina">100</span></div>
      <div class="bar"><label>$</label><div class="bar-track"><span style="width:40%"></span></div><span class="bar-value" data-display="credits">0</span></div>
    </div>
    <div class="hud-cell hud-compass">
      <div class="compass-ring"><span>N</span><em data-compass-deg>0°</em></div>
    </div>
    <div class="hud-cell hud-context">
      <p class="objective" data-objective></p>
      <p class="room-name" data-room></p>
    </div>
  </div>

  <div id="hud-center">
    <svg class="crosshair" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="1.5"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
    <div class="interact-prompt" id="prompt" hidden></div>
  </div>

  <div id="hud-bottom">
    <div class="hud-cell hud-weapon">
      <span class="weapon-name" data-weapon-name>— unarmed —</span>
      <span class="ammo" data-weapon-ammo>— / —</span>
    </div>
    <div class="hud-cell hud-inventory">
      <ol data-inventory></ol>
    </div>
    <div class="hud-cell hud-tip"><span data-tip></span></div>
  </div>
`;

// Panels
const makePanel = (id: string, body: string): HTMLElement => {
  const el = document.createElement('div');
  el.className = 'panel';
  el.id = id;
  el.hidden = true;
  el.innerHTML = body;
  return el;
};

const panelTerminal = makePanel('panel-terminal', `
  <header><span data-terminal-title>TERMINAL</span><button data-close>×</button></header>
  <div class="term-screen" data-terminal-screen></div>
  <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:12px">
    <button data-act="hack">HACK</button>
    <button data-act="logs">LOGS</button>
  </div>
`);

const panelHack = makePanel('panel-hack', `
  <header><span>HACK // TRACE: <span data-hack-traces>3</span> // TIME: <span data-hack-time>0.0</span></span><button data-close>×</button></header>
  <article>
    <pre data-hack-grid></pre>
    <div style="display:flex;flex-direction:column;gap:6px">
      <small>Tokens (1–9):</small>
      <div class="hud-inventory"><ol data-hack-tokens></ol></div>
      <small>2: insert  •  4: clear row • 0: cancel</small>
    </div>
  </article>
`);

const panelLogs = makePanel('panel-logs', `
  <header><span>LOGS</span><button data-close>×</button></header>
  <ol data-log-list></ol>
`);

const panelInventory = makePanel('panel-inventory', `
  <header><span>INVENTORY</span><button data-close>×</button></header>
  <div data-inv-grid></div>
`);

const panelMenu = makePanel('panel-menu', `
  <header><span>PAUSED // OPTIONS</span></header>
  <div class="menu-grid">
    <section>
      <h3>Audio</h3>
      <label>Master <input type="range" min="0" max="100" value="100" data-vol="master"></label>
      <label>SFX <input type="range" min="0" max="100" value="100" data-vol="sfx"></label>
      <label>Voice <input type="range" min="0" max="100" value="100" data-vol="voice"></label>
      <label>Ambient <input type="range" min="0" max="100" value="100" data-vol="ambient"></label>
      <label>Music <input type="range" min="0" max="100" value="100" data-vol="music"></label>
    </section>
    <section>
      <h3>Controls</h3>
      <label>Mouse sensitivity <input type="range" min="1" max="100" value="31" data-sens></label>
      <div class="rebind-list">
        <div class="rebind-row"><span>Forward</span><button data-rebind="forward">W</button></div>
        <div class="rebind-row"><span>Backward</span><button data-rebind="backward">S</button></div>
        <div class="rebind-row"><span>Strafe Left</span><button data-rebind="strafeL">A</button></div>
        <div class="rebind-row"><span>Strafe Right</span><button data-rebind="strafeR">D</button></div>
        <div class="rebind-row"><span>Jump</span><button data-rebind="jump">SPACE</button></div>
        <div class="rebind-row"><span>Crouch</span><button data-rebind="crouch">CTRL</button></div>
        <div class="rebind-row"><span>Interact</span><button data-rebind="interact">E</button></div>
        <div class="rebind-row"><span>Inventory</span><button data-rebind="inventoryToggle">I</button></div>
      </div>
    </section>
    <section>
      <h3>Gameplay</h3>
      <label>Difficulty
        <select data-difficulty>
          <option value="easy">Easy</option>
          <option value="normal" selected>Normal</option>
          <option value="hard">Hard</option>
        </select>
      </label>
      <label><input type="checkbox" data-reduce-motion> Reduce camera motion (headbob)</label>
    </section>
    <section>
      <h3>Save</h3>
      <div style="display:flex;gap:8px">
        <button data-act="export-save">EXPORT SAVE</button>
        <button data-act="import-save">IMPORT SAVE</button>
        <input type="file" data-import-file accept="application/json" hidden>
      </div>
    </section>
  </div>
  <div style="display:flex;justify-content:center;gap:8px;margin-top:18px">
    <button data-act="resume">// RESUME</button>
    <button data-act="mainmenu">// MAIN MENU</button>
  </div>
`);

// Boot
const boot = document.createElement('div');
boot.id = 'boot';
boot.innerHTML = `
  <p>// NEURODOOM</p>
  <h1>NEURODOOM</h1>
  <p>Cyberpunk immersive-sim FPS — visceral combat meets deep systemic simulation.</p>
  <div style="display:flex;gap:16px;justify-content:center">
    <button data-act="newgame">// NEW RUN</button>
    <button data-act="continue" hidden>// CONTINUE</button>
  </div>
  <p style="opacity:0.4">Click anywhere to install neural interface.</p>
`;

// Death
const dead = document.createElement('div');
dead.className = 'panel';
dead.id = 'dead';
dead.hidden = true;
dead.innerHTML = `
  <h2>YOU ARE DEAD</h2>
  <p>The dream feeds on you.</p>
  <div style="display:flex;justify-content:center;gap:8px;margin-top:18px">
    <button data-act="reload">// RESPAWN (LOSE PROGRESS)</button>
    <button data-act="menu">// MAIN MENU</button>
  </div>
`;

// Win / ending
const win = document.createElement('div');
win.className = 'panel';
win.id = 'win';
win.hidden = true;
win.innerHTML = `
  <h2>SHIVA SEVERED</h2>
  <p>The warden falls silent. You jack out, for now.</p>
  <div style="display:flex;justify-content:center;gap:8px;margin-top:18px">
    <button data-act="menu">// MAIN MENU</button>
  </div>
`;

// Mount order matters: bottom → top
root.appendChild(worldCanvas);
root.appendChild(spriteCanvas);
root.appendChild(weaponCanvas);
root.appendChild(fxScan);
root.appendChild(fxVig);
root.appendChild(fxChrom);
root.appendChild(hud);
root.appendChild(panelTerminal);
root.appendChild(panelHack);
root.appendChild(panelLogs);
root.appendChild(panelInventory);
root.appendChild(panelMenu);
root.appendChild(boot);
root.appendChild(dead);
root.appendChild(win);

const prompt = hud.querySelector<HTMLElement>('#prompt')!;

const game = new Game({
  root,
  worldCanvas,
  spriteCanvas,
  weaponCanvas,
  hud,
  boot,
  dead,
  win,
  prompt,
  panelTerminal,
  panelHack,
  panelLogs,
  panelInventory,
  panelMenu,
});

// Mobile: mount on-screen touch controls (movement stick, drag-to-look, action buttons).
if (isTouchDevice()) {
  new TouchControls(root, game.input, hud);
}

void game.beginWithMenu();
