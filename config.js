// Default settings for the first start. After that, the settings made in the launcher window
// are used (saved in the app's user data folder, see README).

module.exports = {
  // The website the kiosk opens. Can also be a local file, e.g. 'file:///Users/me/show/index.html'.
  // Override from the command line: npm start -- --url=https://example.com
  url: 'https://www.zhdk.ch',

  // Key combination that leaves the kiosk and returns to the launcher. All other shortcuts are
  // blocked. Uses Electron accelerator syntax: https://www.electronjs.org/docs/latest/api/accelerator
  // 'CommandOrControl' is Cmd on macOS and Ctrl on Windows/Linux.
  // Set to null to make the kiosk impossible to leave from the keyboard.
  exitShortcut: 'CommandOrControl+Shift+Alt+Q',

  // When the page cannot be loaded (e.g. no network yet), try again after this many seconds.
  retryAfterSeconds: 10,

  // --- Defaults for the options in the launcher ---------------------------

  // Start the kiosk right away when the app opens, without showing the launcher.
  // Same as starting with --kiosk.
  autoLaunch: false,

  // Hide the mouse pointer (e.g. for touch screens or non-interactive displays).
  hideCursor: false,

  // Return to the start URL after this many seconds without mouse/keyboard/touch input.
  // 0 = never.
  resetAfterIdleSeconds: 0,

  // Only allow navigation within the domain of `url`. Links to other sites are ignored.
  restrictToOrigin: false,

  // Page zoom, 1 = 100 %.
  zoomFactor: 1,

  // Automatically allow camera, microphone, location, notifications etc. without asking.
  grantPermissions: true,

  // Delete cookies, local storage and cache every time the kiosk starts (e.g. public terminals).
  clearDataOnStart: false,

  // Start the built app automatically when the user logs in (macOS and Windows, built app only).
  autostart: false,
};
