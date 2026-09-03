# Running multiNicheAI on Windows

This app is built with Expo (React Native), which gives you phone (iOS/Android)
for free. For Windows, the simplest path is to build the Expo web output and
wrap it in Tauri (lighter) or Electron (more mature tooling).

## Steps (Tauri — recommended, smaller install size)

1. Build the web version:
   ```
   npx expo export --platform web
   ```
   This outputs static files to `dist/`.

2. Install Tauri:
   ```
   npm install --save-dev @tauri-apps/cli
   npx tauri init
   ```
   When prompted for the web assets path, point it at `dist/`.

3. Build the Windows executable:
   ```
   npx tauri build
   ```
   Output `.exe`/`.msi` lands in `src-tauri/target/release/`.

## Steps (Electron — alternative)

1. Same `expo export --platform web` step above.
2. `npm install --save-dev electron electron-builder`
3. Add a minimal `electron/main.js` that loads `dist/index.html` in a BrowserWindow.
4. `npx electron-builder --win` to produce the installer.

## Notes
- The chat/auth/credits logic in `screens/` and `api/client.js` doesn't change —
  it's the same JS running in the browser-based Tauri/Electron window as on phone.
- Set `API_BASE_URL` in `api/client.js` to your deployed backend before building.
