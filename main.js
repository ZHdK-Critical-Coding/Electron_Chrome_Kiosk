const { app, BrowserWindow, Menu, powerMonitor, powerSaveBlocker, session } = require('electron');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// `npm run dev` starts the app with --dev: windowed, with dev tools, shortcuts not blocked
const isDev = process.argv.includes('--dev');

// --url=https://... on the command line overrides config.url
const urlArg = process.argv.find((arg) => arg.startsWith('--url='));
const startUrl = urlArg ? urlArg.slice('--url='.length) : config.url;
const startOrigin = new URL(startUrl).origin;

let win;
let quitting = false;

// Look like a regular Chrome browser: some sites refuse to work in "Electron"
app.userAgentFallback = app.userAgentFallback
  .replace(/ Electron\/\S+/, '')
  .replace(new RegExp(` ${app.getName()}/\\S+`), '');

// --- Keyboard -------------------------------------------------------------

// Turn an accelerator like 'CommandOrControl+Shift+Q' into a test for an input event.
// Compares the physical key (input.code), so it also works when Alt changes the character.
function parseAccelerator(accelerator) {
  if (!accelerator) return () => false;
  const parts = accelerator.split('+').map((p) => p.trim().toLowerCase());
  const key = parts.pop();
  const isMac = process.platform === 'darwin';
  const want = { control: false, meta: false, alt: false, shift: false };
  for (const mod of parts) {
    if (mod === 'commandorcontrol' || mod === 'cmdorctrl') want[isMac ? 'meta' : 'control'] = true;
    else if (mod === 'command' || mod === 'cmd' || mod === 'super' || mod === 'meta') want.meta = true;
    else if (mod === 'control' || mod === 'ctrl') want.control = true;
    else if (mod === 'alt' || mod === 'option') want.alt = true;
    else if (mod === 'shift') want.shift = true;
  }
  let code = key;
  if (/^[a-z]$/.test(key)) code = 'key' + key;
  else if (/^[0-9]$/.test(key)) code = 'digit' + key;
  else if (key === 'esc') code = 'escape';
  return (input) =>
    input.code.toLowerCase() === code &&
    input.control === want.control &&
    input.meta === want.meta &&
    input.alt === want.alt &&
    input.shift === want.shift;
}

const isExitShortcut = parseAccelerator(config.exitShortcut);

function handleKeys(event, input) {
  if (input.type !== 'keyDown' && input.type !== 'keyUp') return;

  if (isExitShortcut(input)) {
    event.preventDefault();
    if (input.type === 'keyDown') quit();
    return;
  }

  if (isDev) {
    if (input.type === 'keyDown' && input.key === 'Escape') quit();
    return;
  }

  // Block every key combination with Cmd/Ctrl/Alt, all function keys (F1–F24: reload,
  // dev tools, fullscreen …) and special browser keys. Normal typing still reaches the page.
  if (
    input.control ||
    input.meta ||
    input.alt ||
    /^F\d+$/.test(input.code) ||
    input.code.startsWith('Browser')
  ) {
    event.preventDefault();
  }
}

function quit() {
  quitting = true;
  app.quit();
}

// --- Window ---------------------------------------------------------------

function load() {
  win.loadURL(startUrl);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    kiosk: !isDev, // fullscreen, no dock/taskbar, no app switching on macOS
    fullscreen: !isDev,
    alwaysOnTop: !isDev,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      devTools: isDev,
    },
  });

  const wc = win.webContents;

  wc.on('before-input-event', handleKeys);

  // No pinch-to-zoom
  wc.setVisualZoomLevelLimits(1, 1);

  wc.on('did-finish-load', () => wc.setZoomFactor(config.zoomFactor));

  wc.on('dom-ready', () => {
    if (config.hideCursor) wc.insertCSS('*, *::before, *::after { cursor: none !important; }');
  });

  // Links that would open a new window (target="_blank", window.open) open in the kiosk window
  wc.setWindowOpenHandler(({ url }) => {
    if (isAllowed(url)) wc.loadURL(url);
    return { action: 'deny' };
  });

  wc.on('will-navigate', (event, url) => {
    if (!isAllowed(url)) event.preventDefault();
  });

  // No network yet, server down …: try again later
  wc.on('did-fail-load', (event, errorCode, errorDescription, url, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return; // -3 = aborted, e.g. by a redirect
    console.log(`Could not load ${url} (${errorDescription}), retrying in ${config.retryAfterSeconds}s`);
    setTimeout(load, config.retryAfterSeconds * 1000);
  });

  // The page crashed: start over
  wc.on('render-process-gone', () => setTimeout(load, 1000));

  // Block closing the window (e.g. Alt+F4 on Windows), except via the exit shortcut
  // or when the computer shuts down
  win.on('close', (event) => {
    if (!quitting && !isDev) event.preventDefault();
  });
  win.on('session-end', () => (quitting = true));

  if (isDev) wc.openDevTools({ mode: 'detach' });

  load();
}

function isAllowed(url) {
  if (!config.restrictToOrigin) return true;
  try {
    return new URL(url).origin === startOrigin;
  } catch {
    return false;
  }
}

// Go back to the start page after a period without input
function watchIdle() {
  if (!config.resetAfterIdleSeconds) return;
  let hasReset = true;
  setInterval(() => {
    const idle = powerMonitor.getSystemIdleTime();
    if (idle < config.resetAfterIdleSeconds) {
      hasReset = false;
    } else if (!hasReset) {
      hasReset = true;
      load();
    }
  }, 1000);
}

// --- Extensions -----------------------------------------------------------

// In the built app the folder is unpacked next to app.asar, because Chrome cannot read
// extensions from inside the archive (see "asarUnpack" in package.json)
const extensionsDir = path.join(__dirname, 'extensions').replace('app.asar', 'app.asar.unpacked');

// Load every unpacked extension in extensions/ (folders with a manifest.json, not starting with _)
async function loadExtensions() {
  if (!config.loadExtensions || !fs.existsSync(extensionsDir)) return;
  for (const name of fs.readdirSync(extensionsDir)) {
    const dir = path.join(extensionsDir, name);
    if (name.startsWith('_') || name.startsWith('.')) continue;
    if (!fs.existsSync(path.join(dir, 'manifest.json'))) continue;
    try {
      const ext = await session.defaultSession.extensions.loadExtension(dir, { allowFileAccess: true });
      console.log(`Extension loaded: ${ext.name} ${ext.version} (${name})`);
    } catch (err) {
      console.error(`Extension in ${name} could not be loaded: ${err.message}`);
    }
  }
}

// Dev mode: restart the app when main.js, config.js or an extension changes
function watchForChanges() {
  const restart = () => {
    app.relaunch();
    app.exit(0);
  };
  for (const file of [__filename, path.join(__dirname, 'config.js')]) {
    fs.watch(file, restart);
  }
  if (fs.existsSync(extensionsDir)) {
    let timeout;
    fs.watch(extensionsDir, { recursive: true }, () => {
      clearTimeout(timeout);
      timeout = setTimeout(restart, 300);
    });
  }
}

// --- App ------------------------------------------------------------------

// Only allow one running instance of the app
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) win.focus();
  });

  // Logout / shutdown must not be blocked
  app.on('before-quit', () => (quitting = true));

  app.whenReady().then(async () => {
    // Without an application menu there are no menu shortcuts (Cmd+Q, Cmd+W, Cmd+R, zoom …)
    if (!isDev) Menu.setApplicationMenu(null);

    session.defaultSession.setPermissionRequestHandler((wc, permission, callback) =>
      callback(config.grantPermissions)
    );
    session.defaultSession.setPermissionCheckHandler(() => config.grantPermissions);

    if (config.clearDataOnStart) {
      await session.defaultSession.clearStorageData();
      await session.defaultSession.clearCache();
    }

    if (app.isPackaged && process.platform !== 'linux') {
      app.setLoginItemSettings({ openAtLogin: config.autostart });
    }

    // Before the page loads, so content scripts are injected into it
    await loadExtensions();

    createWindow();
    watchIdle();

    if (isDev) {
      watchForChanges();
    } else {
      // Keep the display awake
      powerSaveBlocker.start('prevent-display-sleep');
    }
  });

  app.on('window-all-closed', () => app.quit());
}
