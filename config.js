// Kiosk settings — edit this file, then restart the app (or rebuild it).

module.exports = {
  // The website the kiosk opens. Can also be a local file, e.g. 'file:///Users/me/show/index.html'.
  // Override without editing this file: npm start -- --url=https://example.com
  url: 'https://www.zhdk.ch',

  // Key combination that quits the kiosk. All other shortcuts are blocked.
  // Uses Electron accelerator syntax: https://www.electronjs.org/docs/latest/api/accelerator
  // 'CommandOrControl' is Cmd on macOS and Ctrl on Windows/Linux.
  // Set to null to make the app impossible to quit from the keyboard.
  exitShortcut: 'CommandOrControl+Shift+Alt+Q',

  // Hide the mouse pointer (e.g. for touch screens or non-interactive displays).
  hideCursor: false,

  // Return to the start URL after this many seconds without mouse/keyboard/touch input.
  // 0 = never.
  resetAfterIdleSeconds: 0,

  // Only allow navigation within the domain of `url`. Links to other sites are ignored.
  restrictToOrigin: false,

  // When the page cannot be loaded (e.g. no network yet), try again after this many seconds.
  retryAfterSeconds: 10,

  // Page zoom, 1 = 100 %.
  zoomFactor: 1,

  // Automatically allow camera, microphone, location, notifications etc. without asking.
  grantPermissions: true,

  // Delete cookies, local storage and cache every time the app starts (e.g. public terminals).
  clearDataOnStart: false,

  // Load the unpacked Chrome extensions in the extensions/ folder (one subfolder per extension).
  // Folders starting with _ are skipped, e.g. extensions/_hide-scrollbars.
  loadExtensions: true,

  // Start the built app automatically when the user logs in (macOS and Windows, built app only).
  autostart: false,
};
