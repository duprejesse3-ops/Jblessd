# Google Play TWA — build & publish guide

This turns the **MULTI-VICE AI** PWA (`https://jblessd.com`) into an Android app
you can upload to the Google Play Store, using a **Trusted Web Activity (TWA)** —
a thin Android wrapper that runs the live website full-screen, with no browser
address bar.

The website side of this is already set up in this repo:

- `twa-manifest.json` — the Bubblewrap build config (name, colors, icons, host).
- `.well-known/assetlinks.json` — the Digital Asset Links file that proves this
  domain owns the app. It ships with a **placeholder fingerprint** that you must
  replace once (see step 4).
- `netlify.toml` — serves `assetlinks.json` as JSON.

The `.aab` file that Google Play needs is built with the Android toolchain
(Java + Android SDK), which runs on your own machine — it is not part of the
Netlify deploy.

## 1. Install Bubblewrap

Bubblewrap is Google's official TWA generator.

```bash
npm install -g @bubblewrap/cli
```

The first run downloads a JDK and the Android SDK for you if they're missing.

## 2. Initialize the Android project

From a folder **outside** this repo (Bubblewrap generates a whole Android
project — don't mix it into the website):

```bash
bubblewrap init --manifest ./twa-manifest.json
```

Point it at the `twa-manifest.json` from this repo. It reads the app name,
colors, and icons straight from the live web manifest, so the app icon and
splash screen match the site.

## 3. Build the app bundle

```bash
bubblewrap build
```

The first build creates a signing keystore (`android.keystore`) and asks you to
set passwords — **save these somewhere safe; you cannot update the app later
without them.** The keystore is git-ignored so it never lands in this repo.

Output: `app-release-bundle.aab` — this is what you upload to Play.

## 4. Wire up domain verification (the important step)

A TWA only runs address-bar-free if `assetlinks.json` on the domain lists the
fingerprint of the key the app is signed with. With Google **Play App Signing**
(on by default), Google re-signs your app, so the fingerprint you need is
**Google's**, available only after your first upload:

1. Upload `app-release-bundle.aab` to a Play Console track (internal testing is
   fine).
2. In Play Console go to **Setup → App integrity → App signing**.
3. Copy the **SHA-256 certificate fingerprint** shown there.
4. Paste it into `.well-known/assetlinks.json` in this repo, replacing
   `REPLACE_WITH_SHA256_FINGERPRINT_FROM_PLAY_CONSOLE`, then deploy.

You can verify it's live by opening
`https://jblessd.com/.well-known/assetlinks.json` — it should return the JSON
with your real fingerprint.

> Tip: if you also test a locally-signed build, add that keystore's fingerprint
> as a second entry in the `sha256_cert_fingerprints` array (it accepts a list).
> Get it with `bubblewrap fingerprint` or `keytool -list -v -keystore android.keystore`.

## 5. Publish

Fill in the Play Console store listing (screenshots, description, category —
the app metadata is separate from this repo), then roll the release out from
your test track to production.

## Updating the app later

- **Website content, prices, catalog** → just deploy the site as usual. The TWA
  loads the live site, so changes appear instantly with no Play update.
- **App name, icon, colors, or Android settings** → edit `twa-manifest.json`,
  bump `appVersionCode`, run `bubblewrap update && bubblewrap build`, and upload
  the new `.aab`.
