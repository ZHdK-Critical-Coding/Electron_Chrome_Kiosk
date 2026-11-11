# Electron: Chrome Kiosk

[Deutsch](README_DE.md)

Opens any website fullscreen in kiosk mode — no address bar, no menus, no
shortcuts. Visitors cannot leave the page, reload it, open the developer
tools or quit the app. For installations, exhibitions and public terminals.
The URL and all other settings are in one file: `config.js`. Ready-made
builds for macOS, Windows and Linux run without Node.js or VS Code.

Based on [Electron_P5_Starter](https://github.com/ZHdK-Critical-Coding/Electron_P5_Starter).

## Installation

Requirements: [Node.js](https://nodejs.org/) (LTS) and
[Visual Studio Code](https://code.visualstudio.com/).

1. Open the folder in Visual Studio Code.
2. Open a terminal (`Terminal → New Terminal`) and install the dependencies
   (only needed once):
   ```sh
   npm install
   ```
3. Open `config.js` and set `url` to the website you want to show.
4. Test it:
   ```sh
   npm run dev
   ```
5. Run it as a kiosk:
   ```sh
   npm start
   ```
   **To quit, press `Cmd` + `Shift` + `Alt` + `Q` (macOS) or
   `Ctrl` + `Shift` + `Alt` + `Q` (Windows/Linux).**

Dependencies (`package.json`): Electron 44, electron-builder 26. The first
start downloads Electron (~100 MB).

## How to Run

| Command                                  | What it does                                                      |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `npm run dev`                            | Window, developer tools, shortcuts work, `Escape` quits           |
| `npm start`                              | Kiosk: fullscreen, all shortcuts blocked, display stays awake     |
| `npm start -- --url=https://example.com` | Kiosk with a different URL, without changing `config.js`          |

In dev mode, the app restarts by itself when you save `config.js`,
`main.js` or a file in `extensions/`.

## Configuration

Everything is set in `config.js`:

| Setting                 | Default                          | Meaning                                                                    |
| ----------------------- | -------------------------------- | -------------------------------------------------------------------------- |
| `url`                   | `'https://www.zhdk.ch'`          | Website to show. Also `file:///…` for a local page                         |
| `exitShortcut`          | `'CommandOrControl+Shift+Alt+Q'` | The only key combination that works: quits the app. `null` = no way out    |
| `hideCursor`            | `false`                          | Hide the mouse pointer                                                     |
| `resetAfterIdleSeconds` | `0`                              | Go back to `url` after this many seconds without input. `0` = never        |
| `restrictToOrigin`      | `false`                          | Ignore links to other websites                                             |
| `retryAfterSeconds`     | `10`                             | Reload after this many seconds if the page could not be loaded             |
| `zoomFactor`            | `1`                              | Page zoom (`1.5` = 150 %)                                                  |
| `grantPermissions`      | `true`                           | Allow camera, microphone, location … without asking                        |
| `clearDataOnStart`      | `false`                          | Delete cookies, logins and cache on every start                            |
| `loadExtensions`        | `true`                           | Load the Chrome extensions in `extensions/`                                |
| `autostart`             | `false`                          | Start the built app on login (macOS, Windows)                              |

`exitShortcut` uses Electron's
[accelerator syntax](https://www.electronjs.org/docs/latest/api/accelerator),
e.g. `'Control+Alt+X'` or `'CommandOrControl+Shift+F12'`. Choose a
combination visitors will not press by accident.

## Chrome Extensions

Unpacked Chrome extensions in the `extensions/` folder are loaded at
startup, one subfolder per extension (the folder that contains
`manifest.json`). Folders starting with `_` are skipped — that is how you
switch an extension off.

The included example `extensions/_hide-scrollbars` hides all scrollbars.
To enable it, rename the folder to `hide-scrollbars` and restart the app.

**Using an extension you have installed in Chrome:**

1. In Chrome, open `chrome://extensions`, turn on *Developer mode* and note
   the extension's ID.
2. Find its folder:
   - macOS: `~/Library/Application Support/Google/Chrome/Default/Extensions/<ID>/<version>/`
   - Windows: `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Extensions\<ID>\<version>\`
   - Linux: `~/.config/google-chrome/Default/Extensions/<ID>/<version>/`
3. Copy the `<version>` folder into `extensions/` and give it a readable
   name, e.g. `extensions/ublock/`.
4. Run `npm run dev` — the terminal shows `Extension loaded: …` or an error.

**Writing your own:** a folder with a `manifest.json` and a
[content script](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
is enough — see the example. A content script can change the CSS of the
page, hide elements or add JavaScript to any website.

**Limits:** Electron only supports
[part of the Chrome extension APIs](https://www.electronjs.org/docs/latest/api/extensions).
Content scripts, `chrome.storage`, `chrome.runtime` messaging and
background service workers work. There is no toolbar, so extension
buttons and popups cannot be opened, and extensions that need e.g.
`chrome.tabs`, `chrome.webRequest` blocking or `declarativeNetRequest` may
not work fully. Test each extension with `npm run dev`. Extensions are
built into the app, like `config.js`.

## What Is Blocked

- **Shortcuts:** every key combination with `Cmd`, `Ctrl` or `Alt`, all
  function keys (`F1`–`F24`) and the browser keys on some keyboards. So no
  reload, back, zoom, print, save, new window, dev tools, quit or close.
  Normal typing (letters, numbers, `Shift`, `Enter`, arrows, `Escape`)
  still reaches the page, so forms and keyboard-controlled pages work.
- **Window:** kiosk fullscreen, always on top, cannot be closed
  (`Alt`+`F4` is ignored). On macOS, the Dock, the menu bar, `Cmd`+`Tab`
  and force quit (`Cmd`+`Alt`+`Esc`) are disabled.
- **Browser:** no address bar, no menu, no context menu, no pinch zoom.
  Links that open a new window open in the kiosk window.
- **Robustness:** the page is reloaded if it cannot be loaded (no network
  yet after booting) or crashes. Only one instance can run. The display is
  kept from going to sleep.

**What cannot be blocked by an app:** system key combinations such as
`Ctrl`+`Alt`+`Del` and the `Windows` key on Windows, or the power button.
For a fully locked-down computer, also use the operating system's kiosk
features (Windows: *Assigned Access*; macOS: a separate user account with
restrictions) and disable gestures and hot corners.

## Building the App

A build turns the project into a standalone app. The current `config.js` is
built into the app — change it before building. All results are saved in
`dist/`.

| Command               | Result                                                                        |
| --------------------- | ----------------------------------------------------------------------------- |
| `npm run pack`        | Quick test build for your own computer, no installer                          |
| `npm run build`       | Build for the computer you are working on                                     |
| `npm run build:mac`   | macOS: `.dmg` and `.zip` (runs on Apple Silicon and Intel)                    |
| `npm run build:win`   | Windows: installer (`Setup.exe`) and `portable.exe` (runs without installing) |
| `npm run build:linux` | Linux: `.AppImage`                                                            |
| `npm run build:all`   | All of the above                                                              |

All platforms can be built from a Mac. The first build takes a while,
because the needed tools are downloaded.

- **Name and version:** change `productName` in the `build` section and
  `version` in `package.json`. Both appear in the file names of the build.
- **App icon:** create a folder `build/` with a square `icon.png` (at least
  1024 × 1024 px). Without it, the default Electron icon is used.
- **Other URL without rebuilding:** start the built app with `--url=…`,
  e.g. on macOS
  `open -a "Electron Chrome Kiosk" --args --url=https://example.com`.
- **Opening the app on another computer:** the builds are not signed, so
  the system warns the first time. macOS: right-click the app → *Open* →
  *Open*; if macOS says the app is "damaged", run
  `xattr -cr "/Applications/Electron Chrome Kiosk.app"`. Windows: in the
  SmartScreen dialog, click *More info* → *Run anyway*. Linux:
  `chmod +x *.AppImage`.

### Building on GitHub

`.github/workflows/build.yml` builds the app for all three platforms on
GitHub's computers — nothing needs to be installed locally.

- Every push to `main`: the apps can be downloaded under *Actions* → the
  latest *Build* run → *Artifacts*.
- Publish a release with the apps attached: change `version` in
  `package.json`, then
  ```sh
  git tag v1.0.0
  git push --tags
  ```
  The apps appear under *Releases* after a few minutes.
- Start a build by hand: *Actions* → *Build* → *Run workflow*.

## Setting Up a Kiosk Computer

1. Build the app (`npm run build:mac` / `build:win`) and install it on the
   kiosk computer.
2. Set `autostart: true` in `config.js` before building — or add the app to
   the login items yourself (macOS: *System Settings → General → Login
   Items*; Windows: put a shortcut in `shell:startup`).
3. Turn on automatic login for the user account and turn off sleep, screen
   saver and system updates during opening hours.
4. If the page uses camera or microphone: start the app once and confirm
   the macOS permission dialog (*System Settings → Privacy & Security*).
5. Restart the computer and check that the page comes up by itself.

## Coding Help

### Project Structure

```
Electron_Chrome_Kiosk/
├── .github/workflows/ # Build on GitHub (build.yml)
├── build/            # (optional) app icon
├── dist/             # Built apps end up here
├── extensions/       # Unpacked Chrome extensions, one folder each
│   └── _hide-scrollbars/   # Example, disabled (starts with _)
├── config.js         # URL and settings — edit this file
├── main.js           # Electron main process (window, kiosk, key blocking)
└── package.json      # Scripts and build configuration
```

### What Happens Where

- **`main.js` → `handleKeys()`**: runs for every key press before the page
  sees it. Quits on `exitShortcut`, otherwise drops all combinations with
  `Cmd`/`Ctrl`/`Alt` and the function keys (`event.preventDefault()`).
- **`main.js` → `createWindow()`**: opens the window in kiosk mode, loads
  the URL and installs the handlers for new windows, navigation, load
  errors, crashes and closing.
- **`main.js` → `loadExtensions()`**: loads every extension folder in
  `extensions/` into the browser session before the page is opened.
- **`main.js` → `watchIdle()`**: checks the system idle time every second
  and reloads the start URL after `resetAfterIdleSeconds`.
- **`main.js` (end)**: removes the application menu (and with it all menu
  shortcuts), sets permissions, clears data, sets autostart, keeps the
  display awake and allows only one running instance.
- **`package.json` → `build`**: electron-builder settings (app id, product
  name, which files go into the app, targets per platform).
