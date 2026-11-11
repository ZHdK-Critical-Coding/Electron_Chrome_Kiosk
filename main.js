const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  nativeTheme,
  powerMonitor,
  powerSaveBlocker,
  session,
  shell,
} = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const config = require('./config');

// `npm run dev`: kiosk opens in a window with dev tools, shortcuts not blocked
const isDev = process.argv.includes('--dev');
const isMac = process.platform === 'darwin';

// --url=… prefills the URL, --kiosk skips the launcher
const urlArg = process.argv.find((arg) => arg.startsWith('--url='));
const launchOnStart = process.argv.includes('--kiosk');

let launcher; // the settings window
let kiosk; // the fullscreen kiosk window
let quitting = false;
let idleTimer;
let powerBlocker;

// Look like a regular Chrome browser: some sites refuse to work in "Electron"
app.userAgentFallback = app.userAgentFallback
  .replace(/ Electron\/\S+/, '')
  .replace(new RegExp(` ${app.getName()}/\\S+`), '');

// --- Settings ---------------------------------------------------------------
// Saved as settings.json in the user data folder; config.js provides the defaults.

const DEFAULTS = {
  url: config.url,
  autoLaunch: config.autoLaunch,
  hideCursor: config.hideCursor,
  resetAfterIdleSeconds: config.resetAfterIdleSeconds,
  restrictToOrigin: config.restrictToOrigin,
  zoomFactor: config.zoomFactor,
  grantPermissions: config.grantPermissions,
  clearDataOnStart: config.clearDataOnStart,
  autostart: config.autostart,
  extensions: {}, // extension id → enabled
};

let settings;

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    settings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) };
  } catch {
    settings = { ...DEFAULTS };
  }
  if (urlArg) settings.url = urlArg.slice('--url='.length);
}

function saveSettings() {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
  if (app.isPackaged && process.platform !== 'linux') {
    app.setLoginItemSettings({ openAtLogin: settings.autostart });
  }
}

// Accept "example.com", "localhost:3000", "/path/to/index.html" as well as full URLs
function normalizeUrl(input) {
  const text = String(input || '').trim();
  if (!text) throw new Error('Please enter a URL.');
  let url;
  if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/|$)/i.test(text)) url = 'http://' + text;
  else if (/^[a-z][a-z0-9+.-]*:/i.test(text)) url = text;
  else if ((text.startsWith('/') || /^[a-z]:\\/i.test(text)) && fs.existsSync(text)) url = pathToFileURL(text).href;
  else url = 'https://' + text;
  try {
    return new URL(url).href;
  } catch {
    throw new Error(`"${text}" is not a valid URL.`);
  }
}

// --- Extensions -------------------------------------------------------------
// Built-in: extensions/ in the project (unpacked next to app.asar in the built app).
// Added in the launcher: copied to extensions/ in the user data folder.

const appExtensionsDir = path.join(__dirname, 'extensions').replace('app.asar', 'app.asar.unpacked');
const userExtensionsDir = () => path.join(app.getPath('userData'), 'extensions');
let extensionErrors = {}; // extension id → error message from the last load

// Resolve names like "__MSG_appName__" from _locales/<default_locale>/messages.json
function localize(dir, manifest, text) {
  const match = /^__MSG_(.+)__$/.exec(text || '');
  if (!match) return text || '';
  try {
    const file = path.join(dir, '_locales', manifest.default_locale || 'en', 'messages.json');
    const messages = JSON.parse(fs.readFileSync(file, 'utf8'));
    const key = Object.keys(messages).find((k) => k.toLowerCase() === match[1].toLowerCase());
    return key ? messages[key].message : text;
  } catch {
    return text;
  }
}

function readManifest(dir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  return {
    name: localize(dir, manifest, manifest.name),
    description: localize(dir, manifest, manifest.description),
    version: manifest.version || '',
  };
}

function listExtensions() {
  const list = [];
  for (const [source, base] of [
    ['app', appExtensionsDir],
    ['user', userExtensionsDir()],
  ]) {
    if (!fs.existsSync(base)) continue;
    for (const folder of fs.readdirSync(base).sort()) {
      const dir = path.join(base, folder);
      if (folder.startsWith('.') || !fs.existsSync(path.join(dir, 'manifest.json'))) continue;
      const id = `${source}:${folder}`;
      let info;
      try {
        info = readManifest(dir);
      } catch {
        info = { name: folder, description: '', version: '' };
        extensionErrors[id] = extensionErrors[id] || 'manifest.json could not be read';
      }
      list.push({
        id,
        dir,
        builtIn: source === 'app',
        // Built-in folders starting with _ are off unless switched on in the launcher
        enabled: settings.extensions[id] ?? !folder.startsWith('_'),
        error: extensionErrors[id] || null,
        ...info,
      });
    }
  }
  return list;
}

// Find the folder with manifest.json: the dropped folder itself, or one or two levels down
// (Chrome stores extensions as <ID>/<version>/). Takes the newest version.
function findManifestDir(dir) {
  if (fs.statSync(dir).isFile()) dir = path.dirname(dir);
  if (fs.existsSync(path.join(dir, 'manifest.json'))) return dir;
  const subdirs = (d) =>
    fs
      .readdirSync(d, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(d, e.name))
      .sort()
      .reverse();
  for (const sub of subdirs(dir)) {
    if (fs.existsSync(path.join(sub, 'manifest.json'))) return sub;
    for (const subsub of subdirs(sub)) {
      if (fs.existsSync(path.join(subsub, 'manifest.json'))) return subsub;
    }
  }
  return null;
}

async function addExtension(source) {
  const dir = findManifestDir(source);
  if (!dir) throw new Error(`${path.basename(source)}: no manifest.json found — is this an unpacked extension?`);
  const { name } = readManifest(dir);
  const folder = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'extension';
  const dest = path.join(userExtensionsDir(), folder);
  // Adding the same extension again replaces (updates) it
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(dir, dest, { recursive: true });
  // Chrome's store signature folder: names starting with _ are not allowed in unpacked extensions
  fs.rmSync(path.join(dest, '_metadata'), { recursive: true, force: true });

  // Test-load it into a temporary session, so errors show up right away
  const id = `user:${folder}`;
  delete extensionErrors[id];
  const test = session.fromPartition('persist:extension-test'); // must be persistent
  for (const ext of test.extensions.getAllExtensions()) test.extensions.removeExtension(ext.id);
  try {
    const ext = await test.extensions.loadExtension(dest, { allowFileAccess: true });
    test.extensions.removeExtension(ext.id);
  } catch (err) {
    extensionErrors[id] = err.message;
  }
  settings.extensions[id] = true;
  saveSettings();
}

async function loadKioskExtensions(ses) {
  for (const ext of ses.extensions.getAllExtensions()) ses.extensions.removeExtension(ext.id);
  extensionErrors = {};
  for (const ext of listExtensions().filter((e) => e.enabled)) {
    try {
      const loaded = await ses.extensions.loadExtension(ext.dir, { allowFileAccess: true });
      console.log(`Extension loaded: ${loaded.name} ${loaded.version}`);
    } catch (err) {
      extensionErrors[ext.id] = err.message;
      console.error(`Extension ${ext.name} could not be loaded: ${err.message}`);
    }
  }
}

// --- Keyboard ---------------------------------------------------------------

// Turn an accelerator like 'CommandOrControl+Shift+Q' into a test for an input event.
// Compares the physical key (input.code), so it also works when Alt changes the character.
function parseAccelerator(accelerator) {
  if (!accelerator) return () => false;
  const parts = accelerator.split('+').map((p) => p.trim().toLowerCase());
  const key = parts.pop();
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

// 'CommandOrControl+Shift+Alt+Q' → '⌘ ⇧ ⌥ Q' (macOS) or 'Ctrl + Shift + Alt + Q'
function prettyShortcut(accelerator) {
  if (!accelerator) return null;
  const mac = { commandorcontrol: '⌘', cmdorctrl: '⌘', command: '⌘', cmd: '⌘', control: '⌃', ctrl: '⌃', alt: '⌥', option: '⌥', shift: '⇧' };
  const other = { commandorcontrol: 'Ctrl', cmdorctrl: 'Ctrl', control: 'Ctrl', ctrl: 'Ctrl', alt: 'Alt', option: 'Alt', shift: 'Shift' };
  const names = isMac ? mac : other;
  return accelerator
    .split('+')
    .map((p) => names[p.trim().toLowerCase()] || p.trim())
    .join(isMac ? ' ' : ' + ');
}

const isExitShortcut = parseAccelerator(config.exitShortcut);

function handleKioskKeys(event, input) {
  if (input.type !== 'keyDown' && input.type !== 'keyUp') return;

  if (isExitShortcut(input)) {
    event.preventDefault();
    if (input.type === 'keyDown') exitKiosk();
    return;
  }

  if (isDev) {
    if (input.type === 'keyDown' && input.key === 'Escape') exitKiosk();
    return;
  }

  // Block every key combination with Cmd/Ctrl/Alt, all function keys (F1–F24: reload,
  // dev tools, fullscreen …) and special browser keys. Normal typing still reaches the page.
  if (input.control || input.meta || input.alt || /^F\d+$/.test(input.code) || input.code.startsWith('Browser')) {
    event.preventDefault();
  }
}

// --- Kiosk window -----------------------------------------------------------

async function launchKiosk() {
  if (kiosk) return;
  const ses = session.defaultSession;

  // Without an application menu there are no menu shortcuts (Cmd+Q, Cmd+W, Cmd+R, zoom …)
  if (!isDev) Menu.setApplicationMenu(null);
  if (settings.clearDataOnStart) {
    await ses.clearStorageData();
    await ses.clearCache();
  }
  // Before the page loads, so content scripts are injected into it
  await loadKioskExtensions(ses);

  const startUrl = settings.url;
  const startOrigin = new URL(startUrl).origin;
  const isAllowed = (url) => {
    if (!settings.restrictToOrigin) return true;
    try {
      return new URL(url).origin === startOrigin;
    } catch {
      return false;
    }
  };

  kiosk = new BrowserWindow({
    width: 1280,
    height: 800,
    kiosk: !isDev, // fullscreen, no dock/taskbar, no app switching on macOS
    fullscreen: !isDev,
    alwaysOnTop: !isDev,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: { devTools: isDev },
  });

  const wc = kiosk.webContents;
  // Load errors are handled by 'did-fail-load' below, so the promise's rejection is ignored
  const load = () => kiosk && !kiosk.isDestroyed() && wc.loadURL(startUrl).catch(() => {});

  wc.on('before-input-event', handleKioskKeys);
  wc.setVisualZoomLevelLimits(1, 1); // no pinch-to-zoom
  wc.on('did-finish-load', () => wc.setZoomFactor(settings.zoomFactor));
  wc.on('dom-ready', () => {
    if (settings.hideCursor) wc.insertCSS('*, *::before, *::after { cursor: none !important; }');
  });

  // Links that would open a new window (target="_blank", window.open) open in the kiosk window
  wc.setWindowOpenHandler(({ url }) => {
    if (isAllowed(url)) wc.loadURL(url).catch(() => {});
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
  kiosk.on('close', (event) => {
    if (!quitting && !isDev) event.preventDefault();
  });
  kiosk.on('session-end', () => (quitting = true));
  kiosk.on('closed', onKioskClosed);

  if (isDev) wc.openDevTools({ mode: 'detach' });

  load();
  launcher.hide();

  powerBlocker = powerSaveBlocker.start('prevent-display-sleep');
  startIdleWatch(load);
}

function exitKiosk() {
  if (!kiosk || kiosk.isDestroyed() || kiosk.exiting) return;
  kiosk.exiting = true;
  const win = kiosk;
  const close = () => !win.isDestroyed() && win.destroy(); // destroy() skips the 'close' block
  if (!win.isFullScreen()) return close();
  // Leave fullscreen first. Otherwise macOS keeps the fullscreen space and the launcher
  // reappears in fullscreen.
  win.once('leave-full-screen', () => setTimeout(close, 100));
  setTimeout(close, 2000); // in case the event never comes
  win.setKiosk(false);
  win.setFullScreen(false);
}

function onKioskClosed() {
  kiosk = null;
  clearInterval(idleTimer);
  if (powerBlocker !== undefined) powerSaveBlocker.stop(powerBlocker);
  if (quitting) return;
  Menu.setApplicationMenu(launcherMenu());
  launcher.webContents.send('state', getState()); // show extension errors from this run
  if (launcher.isFullScreen()) launcher.setFullScreen(false);
  launcher.show();
  launcher.focus();
}

// Go back to the start page after a period without input
function startIdleWatch(load) {
  clearInterval(idleTimer);
  if (!settings.resetAfterIdleSeconds) return;
  let hasReset = true;
  idleTimer = setInterval(() => {
    if (powerMonitor.getSystemIdleTime() < settings.resetAfterIdleSeconds) {
      hasReset = false;
    } else if (!hasReset) {
      hasReset = true;
      load();
    }
  }, 1000);
}

// --- Launcher window --------------------------------------------------------

function launcherMenu() {
  const template = [];
  if (isMac) template.push({ role: 'appMenu' });
  template.push({ role: 'editMenu' }); // copy & paste in the URL field
  if (isDev) template.push({ role: 'viewMenu' }); // reload, dev tools
  template.push({ role: 'windowMenu' });
  return Menu.buildFromTemplate(template);
}

function createLauncher() {
  launcher = new BrowserWindow({
    width: 760,
    height: 760,
    minWidth: 520,
    minHeight: 480,
    show: false,
    title: 'Chrome Kiosk',
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#17181b' : '#f4f4f2',
    webPreferences: {
      preload: path.join(__dirname, 'launcher', 'preload.js'),
      partition: 'launcher', // separate from the kiosk, so extensions don't run here
      contextIsolation: true,
      sandbox: true,
    },
  });
  launcher.loadFile(path.join(__dirname, 'launcher', 'index.html'));
  launcher.once('ready-to-show', () => {
    if (!kiosk) launcher.show();
  });
  // Dropping a file outside the drop zone must not navigate away from the launcher
  launcher.webContents.on('will-navigate', (event) => event.preventDefault());
  launcher.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

function getState() {
  return {
    settings,
    extensions: listExtensions(),
    exitShortcut: prettyShortcut(config.exitShortcut),
    version: app.getVersion(),
    isDev,
    userExtensionsDir: userExtensionsDir(),
  };
}

// Calls from the launcher page (see launcher/preload.js)
function registerIpc() {
  ipcMain.handle('get-state', () => getState());

  ipcMain.handle('save-settings', (event, changes) => {
    const allowed = Object.keys(DEFAULTS).filter((k) => k !== 'extensions' && k !== 'url');
    for (const key of allowed) if (key in changes) settings[key] = changes[key];
    saveSettings();
    return getState();
  });

  ipcMain.handle('launch', async (event, url) => {
    try {
      settings.url = normalizeUrl(url);
    } catch (err) {
      return { error: err.message };
    }
    saveSettings();
    await launchKiosk();
    return { url: settings.url };
  });

  ipcMain.handle('add-extensions', async (event, paths) => {
    const errors = [];
    for (const p of paths) {
      try {
        await addExtension(p);
      } catch (err) {
        errors.push(err.message);
      }
    }
    return { ...getState(), errors };
  });

  ipcMain.handle('choose-extensions', async () => {
    const result = await dialog.showOpenDialog(launcher, {
      title: 'Add extension folder',
      buttonLabel: 'Add',
      properties: ['openDirectory', 'multiSelections'],
    });
    const errors = [];
    for (const p of result.canceled ? [] : result.filePaths) {
      try {
        await addExtension(p);
      } catch (err) {
        errors.push(err.message);
      }
    }
    return { ...getState(), errors };
  });

  ipcMain.handle('set-extension-enabled', (event, id, enabled) => {
    settings.extensions[id] = Boolean(enabled);
    saveSettings();
    return getState();
  });

  ipcMain.handle('remove-extension', (event, id) => {
    const ext = listExtensions().find((e) => e.id === id);
    if (ext && !ext.builtIn) fs.rmSync(ext.dir, { recursive: true, force: true });
    delete settings.extensions[id];
    delete extensionErrors[id];
    saveSettings();
    return getState();
  });

  ipcMain.handle('show-extension', (event, id) => {
    const ext = listExtensions().find((e) => e.id === id);
    if (ext) shell.showItemInFolder(path.join(ext.dir, 'manifest.json'));
  });
}

// Dev mode: restart the app when main.js or config.js changes, reload the launcher
// when a file in launcher/ changes
function watchForChanges() {
  for (const file of [__filename, path.join(__dirname, 'config.js')]) {
    fs.watch(file, () => {
      app.relaunch();
      app.exit(0);
    });
  }
  let timeout;
  fs.watch(path.join(__dirname, 'launcher'), { recursive: true }, () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => launcher && launcher.webContents.reloadIgnoringCache(), 100);
  });
}

// --- App --------------------------------------------------------------------

// Only allow one running instance of the app
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = kiosk || launcher;
    if (win) {
      win.show();
      win.focus();
    }
  });

  // Logout / shutdown must not be blocked
  app.on('before-quit', () => (quitting = true));

  app.whenReady().then(async () => {
    loadSettings();
    registerIpc();
    Menu.setApplicationMenu(launcherMenu());

    session.defaultSession.setPermissionRequestHandler((wc, permission, callback) =>
      callback(settings.grantPermissions)
    );
    session.defaultSession.setPermissionCheckHandler(() => settings.grantPermissions);

    createLauncher();
    if (isDev) watchForChanges();

    if (launchOnStart || settings.autoLaunch) {
      try {
        settings.url = normalizeUrl(settings.url);
        await launchKiosk();
      } catch (err) {
        console.error(err.message);
      }
    }
  });

  app.on('window-all-closed', () => app.quit());
}
