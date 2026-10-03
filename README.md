# Billy: Bill Management

Billy is a Bill Management software that is **privacy-focused** and runs entirely **locally**. This application is designed with the express purpose of allowing users to input both income and expenses to gain extended insight into their financial spending.

This was originally written with Node as a personal finance software, but in an effort to hone my React skills I decided I would redesign it in React with an extended set of features.

This branch is the React Native version, built with [Expo](https://expo.dev) (SDK 57). It only uses modules that ship inside **Expo Go**, so it runs on a phone without a native build.

## Running it

```bash
npm install
npm start          # starts Metro and prints a QR code
```

Scan the QR code with **Expo Go** (Android) or the Camera app (iOS). Your phone and PC need to be on the same Wi-Fi; if that doesn't work, use `npx expo start --tunnel`.

| Script | What it does |
| --- | --- |
| `npm start` | Dev server (press `a` for an Android emulator, `r` to reload, `j` for the debugger) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint via `expo lint` |
| `npm run doctor` | Checks dependency versions against the Expo SDK |

## Installing it on an iPhone (no Mac, no paid Apple account)

[`.github/workflows/ios-unsigned-ipa.yml`](.github/workflows/ios-unsigned-ipa.yml) builds an **unsigned** `.ipa` on a GitHub-hosted Mac (free for public repos). [Sideloadly](https://sideloadly.io) then signs it with your normal Apple ID and installs it.

1. Start a build:
   - **Push a tag**, e.g. `git tag v1.0.0 && git push origin v1.0.0`. The `.ipa` is attached to a GitHub Release for that tag.
   - Or press **Run workflow** in the repo's Actions tab. GitHub only shows this button for workflows on the default branch (`main`).
2. Download the `.ipa` from the release, or from the run's **Artifacts** section (that download is a zip containing the `.ipa`).
3. On Windows, install Sideloadly plus the **non-Microsoft-Store** versions of iTunes and iCloud. Connect the iPhone, drop the `.ipa` in, and sign in with your Apple ID.
4. On the iPhone:
   - Trust your Apple ID under Settings → General → VPN & Device Management.
   - Turn on Settings → Privacy & Security → Developer Mode (iOS 16+).

Free Apple ID signatures expire after **7 days**. Sideloadly's auto-refresh re-signs the app before then, or you can install the `.ipa` again. Reinstalling over the app keeps its data. Deleting the app deletes the vault, so keep a JSON export as a backup.

## Project layout

Navigation uses [Expo Router](https://docs.expo.dev/router/introduction/) with the platform's native tab bar (Liquid Glass on iOS 26, Material on Android).

```
src/app/_layout.tsx          root: fonts/splash, auto-lock, app-switcher privacy, lock screen vs. tabs
src/app/unlock.tsx           PIN setup / unlock (shown whenever the vault is locked)
src/app/(tabs)/_layout.tsx   native bottom tabs + blurred header, floating + Bill / + Income, add/edit modals
src/app/(tabs)/*.tsx         one file per tab (index = Dashboard, bills, income, privacy)
src/components/              screens: Dashboard, Bills, Income, PrivacyScreen, PinScreen, AddBill, AddIncome
src/components/ui/           building blocks: AppText, Button, Card, ModalShell, FormControls, PieChart, ...
src/context/                 FinanceContext (vault, data, export/import), EditorContext, TabChromeContext
src/utils/                   cryptoWrapper + pbkdf2 (vault encryption), storageAdapter, financeHelpers, dates
assets/                      Noto Serif fonts, logos, app icon/splash images
```

## Storage and encryption

The vault is `billy_secure_vault.json` in the app's private documents directory. It's AES-256-GCM encrypted with a key derived from your 6-digit PIN (PBKDF2-SHA256, 100k iterations), using the same byte format as the desktop version. The key is derived once when you unlock (about 2–3 seconds) and kept in memory until the app locks, either on restart or after 2 minutes in the background (`AUTO_LOCK_AFTER_MS` in `src/app/_layout.tsx`).
