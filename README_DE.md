# Electron: Chrome Kiosk

[English](README.md)

Öffnet eine beliebige Website im Vollbild-Kioskmodus – ohne Adressleiste,
ohne Menüs, ohne Tastenkürzel. Besucher:innen können die Seite nicht
verlassen, nicht neu laden, keine Entwicklertools öffnen und die App nicht
beenden. Für Installationen, Ausstellungen und öffentliche Terminals. Die
URL und alle weiteren Einstellungen stehen in einer Datei: `config.js`.
Fertige Builds für macOS, Windows und Linux laufen ohne Node.js oder VS Code.

Basiert auf [Electron_P5_Starter](https://github.com/ZHdK-Critical-Coding/Electron_P5_Starter).

## Installation

Voraussetzungen: [Node.js](https://nodejs.org/) (LTS) und
[Visual Studio Code](https://code.visualstudio.com/).

1. Den Ordner in Visual Studio Code öffnen.
2. Ein Terminal öffnen (`Terminal → New Terminal`) und die Abhängigkeiten
   installieren (nur einmal nötig):
   ```sh
   npm install
   ```
3. `config.js` öffnen und bei `url` die gewünschte Website eintragen.
4. Testen:
   ```sh
   npm run dev
   ```
5. Als Kiosk starten:
   ```sh
   npm start
   ```
   **Beenden mit `Cmd` + `Shift` + `Alt` + `Q` (macOS) bzw.
   `Ctrl` + `Shift` + `Alt` + `Q` (Windows/Linux).**

Abhängigkeiten (`package.json`): Electron 44, electron-builder 26. Beim
ersten Start wird Electron heruntergeladen (~100 MB).

## Ausführen

| Befehl                                   | Was passiert                                                         |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `npm run dev`                            | Fenster, Entwicklertools, Tastenkürzel aktiv, `Escape` beendet       |
| `npm start`                              | Kiosk: Vollbild, alle Tastenkürzel gesperrt, Bildschirm bleibt an    |
| `npm start -- --url=https://example.com` | Kiosk mit anderer URL, ohne `config.js` zu ändern                    |

Im Entwicklungsmodus startet die App von selbst neu, wenn `config.js`,
`main.js` oder eine Datei in `extensions/` gespeichert wird.

## Konfiguration

Alles wird in `config.js` eingestellt:

| Einstellung             | Standard                         | Bedeutung                                                                    |
| ----------------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| `url`                   | `'https://www.zhdk.ch'`          | Anzuzeigende Website. Auch `file:///…` für eine lokale Seite                 |
| `exitShortcut`          | `'CommandOrControl+Shift+Alt+Q'` | Einzige funktionierende Tastenkombination: beendet die App. `null` = kein Ausweg |
| `hideCursor`            | `false`                          | Mauszeiger ausblenden                                                        |
| `resetAfterIdleSeconds` | `0`                              | Nach so vielen Sekunden ohne Eingabe zurück zu `url`. `0` = nie              |
| `restrictToOrigin`      | `false`                          | Links auf andere Websites ignorieren                                         |
| `retryAfterSeconds`     | `10`                             | Neu laden nach so vielen Sekunden, wenn die Seite nicht geladen werden konnte |
| `zoomFactor`            | `1`                              | Seitenzoom (`1.5` = 150 %)                                                   |
| `grantPermissions`      | `true`                           | Kamera, Mikrofon, Standort … ohne Nachfrage erlauben                         |
| `clearDataOnStart`      | `false`                          | Cookies, Logins und Cache bei jedem Start löschen                            |
| `loadExtensions`        | `true`                           | Chrome-Erweiterungen in `extensions/` laden                                  |
| `autostart`             | `false`                          | Gebaute App beim Anmelden starten (macOS, Windows)                           |

`exitShortcut` verwendet die
[Accelerator-Syntax](https://www.electronjs.org/docs/latest/api/accelerator)
von Electron, z. B. `'Control+Alt+X'` oder `'CommandOrControl+Shift+F12'`.
Eine Kombination wählen, die niemand aus Versehen drückt.

## Chrome-Erweiterungen

Entpackte Chrome-Erweiterungen im Ordner `extensions/` werden beim Start
geladen, ein Unterordner pro Erweiterung (der Ordner, der `manifest.json`
enthält). Ordner, die mit `_` beginnen, werden übersprungen – so lässt
sich eine Erweiterung ausschalten.

Das mitgelieferte Beispiel `extensions/hide-scrollbars` blendet alle
Scrollbalken aus und ist aktiv. Zum Ausschalten den Ordner in
`_hide-scrollbars` umbenennen und die App neu starten.

**Eine in Chrome installierte Erweiterung verwenden:**

1. In Chrome `chrome://extensions` öffnen, den *Entwicklermodus*
   einschalten und die ID der Erweiterung notieren.
2. Ihren Ordner suchen:
   - macOS: `~/Library/Application Support/Google/Chrome/Default/Extensions/<ID>/<Version>/`
   - Windows: `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Extensions\<ID>\<Version>\`
   - Linux: `~/.config/google-chrome/Default/Extensions/<ID>/<Version>/`
3. Den `<Version>`-Ordner nach `extensions/` kopieren und lesbar benennen,
   z. B. `extensions/ublock/`.
4. `npm run dev` starten – im Terminal erscheint `Extension loaded: …` oder
   eine Fehlermeldung.

**Eigene Erweiterung schreiben:** Ein Ordner mit `manifest.json` und einem
[Content Script](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
genügt – siehe Beispiel. Ein Content Script kann das CSS der Seite ändern,
Elemente ausblenden oder JavaScript in jede Website einfügen.

**Einschränkungen:** Electron unterstützt nur
[einen Teil der Chrome-Extension-APIs](https://www.electronjs.org/docs/latest/api/extensions).
Content Scripts, `chrome.storage`, `chrome.runtime`-Messaging und
Background Service Worker funktionieren. Es gibt keine Symbolleiste, daher
lassen sich Erweiterungs-Buttons und Popups nicht öffnen, und
Erweiterungen, die z. B. `chrome.tabs`, blockierendes `chrome.webRequest`
oder `declarativeNetRequest` brauchen, funktionieren evtl. nur teilweise.
Jede Erweiterung mit `npm run dev` testen. Erweiterungen werden wie
`config.js` in die App eingebaut.

## Was gesperrt ist

- **Tastenkürzel:** jede Tastenkombination mit `Cmd`, `Ctrl` oder `Alt`,
  alle Funktionstasten (`F1`–`F24`) und die Browser-Tasten mancher
  Tastaturen. Also kein Neuladen, Zurück, Zoomen, Drucken, Speichern, neues
  Fenster, Entwicklertools, Beenden oder Schliessen. Normales Tippen
  (Buchstaben, Zahlen, `Shift`, `Enter`, Pfeiltasten, `Escape`) kommt
  weiterhin bei der Seite an – Formulare und tastaturgesteuerte Seiten
  funktionieren.
- **Fenster:** Kiosk-Vollbild, immer im Vordergrund, kann nicht geschlossen
  werden (`Alt`+`F4` wird ignoriert). Unter macOS sind Dock, Menüleiste,
  `Cmd`+`Tab` und Sofort beenden (`Cmd`+`Alt`+`Esc`) deaktiviert.
- **Browser:** keine Adressleiste, kein Menü, kein Kontextmenü, kein
  Pinch-Zoom. Links, die ein neues Fenster öffnen würden, öffnen sich im
  Kiosk-Fenster.
- **Robustheit:** Die Seite wird neu geladen, wenn sie nicht geladen werden
  kann (z. B. noch kein Netzwerk nach dem Hochfahren) oder abstürzt. Es
  läuft immer nur eine Instanz. Der Bildschirm geht nicht in den Ruhezustand.

**Was eine App nicht sperren kann:** Systemtasten wie `Ctrl`+`Alt`+`Del`
und die `Windows`-Taste unter Windows oder den Ein-/Aus-Knopf. Für einen
komplett abgeriegelten Computer zusätzlich die Kiosk-Funktionen des
Betriebssystems nutzen (Windows: *Zugewiesener Zugriff*; macOS: eigenes
Benutzerkonto mit Einschränkungen) und Gesten sowie aktive Ecken
ausschalten.

## App bauen

Ein Build macht aus dem Projekt eine eigenständige App. Die aktuelle
`config.js` wird in die App eingebaut – vor dem Bauen anpassen. Alle
Ergebnisse landen in `dist/`.

| Befehl                | Ergebnis                                                                          |
| --------------------- | --------------------------------------------------------------------------------- |
| `npm run pack`        | Schneller Test-Build für den eigenen Computer, ohne Installer                     |
| `npm run build`       | Build für den Computer, an dem gearbeitet wird                                    |
| `npm run build:mac`   | macOS: `.dmg` und `.zip` (läuft auf Apple Silicon und Intel)                      |
| `npm run build:win`   | Windows: Installer (`Setup.exe`) und `portable.exe` (läuft ohne Installation)     |
| `npm run build:linux` | Linux: `.AppImage`                                                                |
| `npm run build:all`   | Alle oben genannten                                                               |

Alle Plattformen können auf einem Mac gebaut werden. Der erste Build dauert
eine Weile, weil die nötigen Werkzeuge heruntergeladen werden.

- **Name und Version:** `productName` im Abschnitt `build` und `version` in
  `package.json` ändern. Beide erscheinen in den Dateinamen des Builds.
- **App-Icon:** einen Ordner `build/` mit einem quadratischen `icon.png`
  (mindestens 1024 × 1024 px) anlegen. Ohne Icon wird das Electron-Icon
  verwendet.
- **Andere URL ohne neu zu bauen:** die gebaute App mit `--url=…` starten,
  z. B. unter macOS
  `open -a "Electron Chrome Kiosk" --args --url=https://example.com`.
- **App auf einem anderen Computer öffnen:** Die Builds sind nicht
  signiert, deshalb warnt das System beim ersten Öffnen. macOS: Rechtsklick
  auf die App → *Öffnen* → *Öffnen*; meldet macOS, die App sei
  «beschädigt», `xattr -cr "/Applications/Electron Chrome Kiosk.app"`
  ausführen. Windows: im SmartScreen-Dialog *Weitere Informationen* →
  *Trotzdem ausführen*. Linux: `chmod +x *.AppImage`.

### Auf GitHub bauen

`.github/workflows/build.yml` baut die App für alle drei Plattformen auf
den Computern von GitHub – lokal muss nichts installiert sein.

- Bei jedem Push auf `main`: Die Apps können unter *Actions* → letzter
  *Build*-Lauf → *Artifacts* heruntergeladen werden.
- Release mit angehängten Apps veröffentlichen: `version` in
  `package.json` anpassen, dann
  ```sh
  git tag v1.0.0
  git push --tags
  ```
  Nach einigen Minuten erscheinen die Apps unter *Releases*.
- Build von Hand starten: *Actions* → *Build* → *Run workflow*.

## Kiosk-Computer einrichten

1. App bauen (`npm run build:mac` / `build:win`) und auf dem
   Kiosk-Computer installieren.
2. Vor dem Bauen `autostart: true` in `config.js` setzen – oder die App
   selbst zu den Anmeldeobjekten hinzufügen (macOS: *Systemeinstellungen →
   Allgemein → Anmeldeobjekte*; Windows: Verknüpfung in `shell:startup`
   ablegen).
3. Automatische Anmeldung für das Benutzerkonto einschalten, Ruhezustand,
   Bildschirmschoner und Systemupdates während der Öffnungszeiten
   ausschalten.
4. Verwendet die Seite Kamera oder Mikrofon: App einmal starten und den
   macOS-Berechtigungsdialog bestätigen (*Systemeinstellungen → Datenschutz
   & Sicherheit*).
5. Computer neu starten und prüfen, ob die Seite von selbst erscheint.

## Hilfe zum Code

### Projektstruktur

```
Electron_Chrome_Kiosk/
├── .github/workflows/ # Build auf GitHub (build.yml)
├── build/            # (optional) App-Icon
├── dist/             # Hier landen die gebauten Apps
├── extensions/       # Entpackte Chrome-Erweiterungen, je ein Ordner
│   └── hide-scrollbars/    # Beispiel: blendet Scrollbalken aus (aktiv)
├── config.js         # URL und Einstellungen – diese Datei bearbeiten
├── main.js           # Electron-Hauptprozess (Fenster, Kiosk, Tastensperre)
└── package.json      # Skripte und Build-Konfiguration
```

### Was passiert wo

- **`main.js` → `handleKeys()`**: läuft bei jedem Tastendruck, bevor die
  Seite ihn sieht. Beendet bei `exitShortcut` die App, verwirft sonst alle
  Kombinationen mit `Cmd`/`Ctrl`/`Alt` und die Funktionstasten
  (`event.preventDefault()`).
- **`main.js` → `createWindow()`**: öffnet das Fenster im Kioskmodus, lädt
  die URL und setzt die Handler für neue Fenster, Navigation, Ladefehler,
  Abstürze und Schliessen.
- **`main.js` → `loadExtensions()`**: lädt jeden Erweiterungsordner in
  `extensions/` in die Browser-Session, bevor die Seite geöffnet wird.
- **`main.js` → `watchIdle()`**: prüft jede Sekunde die Leerlaufzeit des
  Systems und lädt nach `resetAfterIdleSeconds` die Start-URL neu.
- **`main.js` (Ende)**: entfernt das App-Menü (und damit alle
  Menü-Tastenkürzel), setzt Berechtigungen, löscht Daten, setzt den
  Autostart, hält den Bildschirm wach und erlaubt nur eine laufende Instanz.
- **`package.json` → `build`**: electron-builder-Einstellungen (App-ID,
  Produktname, welche Dateien in die App kommen, Ziele pro Plattform).
