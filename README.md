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

| Script | Description |
| --- | --- |
| `npm start` | Dev server (press `a` for an Android emulator, `r` to reload, `j` for the debugger) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest unit and component tests (`npm test -- --watch` while working) |
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
   - Trust your Apple ID under Settings > General > VPN & Device Management.
   - Turn on Settings > Privacy & Security > Developer Mode (iOS 16+).

Free Apple ID signatures expire after **7 days**. Sideloadly's auto-refresh re-signs the app before then, or you can install the `.ipa` again. Reinstalling over the app keeps its data. Deleting the app deletes the vault, so keep a JSON export as a backup.

## Features

- **Dashboard:** Pay-period budgets, upcoming and overdue bills, credit utilization monthly income and expenses, 50/30/20 split suggestions, and cash-flow charts.
- **Bills tab:**
  - **Bills:** Fixed bills with paid tracking and the actual amount paid.
  - **Budgets:** Variable spending like groceries, set weekly, monthly or per pay period, with logged spending and what's left. Spending can be put on a credit card, which adds it to that card's balance.
  - **Cards:** Credit card balances with payoff dates and interest. Make a payment or add a charge at any time, outside the monthly schedule; each card lists its recent activity.
  - **Loans:** Car loans and financed purchases, with progress, payoff dates and a warning when a 0% promo won't be cleared before it ends. Extra payments can be made at any time.
- **Income tab:**
  - **Income:** Set up income pay periods, defining either fixed income, salaries, and payment frequencies. When a paycheck comes in different (hours, overtime), enter what you actually made; it replaces the usual amount for that payday only.
  - **Savings Goals:** Set goals to save towards, including sales tax and a target date. Targeted savings goals are prioritized over non-targeted ones to ensure goals are met.
- **Dashboard credit utilization:** Current vs. target (under 30%, ideally 10%), how much to pay down, and per-card figures.
- **Calendar:** Monthly view of due dates, paydays and spending; tap a day to see or pay what's on it.
- **Settings:**
  - Biometric unlock.
  - Bill reminders, as local notifications.
  - Which paycheck defines the pay period.
  - Import, export and delete data (**Note: This exported data is unencrypted, Billy warns you of this as well.**)

## Project layout

Navigation uses [Expo Router](https://docs.expo.dev/router/introduction/) with your platform's native tab bar (Liquid Glass on iOS 26, Material on Android).

```
src/app/_layout.tsx          root: fonts/splash, auto-lock, app-switcher privacy, lock screen vs. tabs
src/app/unlock.tsx           PIN / biometric unlock (shown whenever the vault is locked)
src/app/(tabs)/_layout.tsx   native bottom tabs + blurred header, floating + buttons, all add/edit modals
src/app/(tabs)/*.tsx         one file per tab (index = Dashboard, bills, income, calendar, settings)
src/components/              screens and modals (Dashboard, SpendingTab, CalendarView, SettingsScreen, Add*, ...)
src/components/ui/           building blocks: AppText, Button, Card, ModalShell, FormControls, PieChart, ...
src/context/                 FinanceContext (vault data + actions), EditorContext, TabChromeContext
src/types.ts                 the vault's data model
src/utils/schedule.ts        expands bills, card payments and paychecks into dated occurrences
src/utils/                   payPeriod, budgets, cards, reminders, notifications, biometrics, crypto, storage
src/**/__tests__/            Jest tests: date/schedule/money logic, vault encryption, FinanceContext, screens
src/test-utils/              test helpers: stand-ins for device services, a vault-backed render, a fixed "today"
plugins/                     config plugin that drops the push entitlement (Billy only uses local notifications)
assets/                      Noto Serif fonts, logos, app icon/splash/notification images
```

## Storage and encryption

The vault is `billy_secure_vault.json` in the app's private documents directory. It's AES-256-GCM encrypted with a key derived from your 6-digit PIN (PBKDF2-SHA256, 100k iterations), using the same byte format as the desktop version. The key is derived once when you unlock (about 2–3 seconds) and kept in memory until the app locks, either on restart or after 2 minutes in the background (`AUTO_LOCK_AFTER_MS` in `src/app/_layout.tsx`).

With biometric unlock on, a copy of that derived key is stored in the iOS Keychain / Android Keystore. The OS only releases it after Face ID or a fingerprint, and it never leaves the device or syncs. Unlocking with it skips the PIN step. If your enrolled biometrics change, the OS invalidates the key and Billy falls back to the PIN.

Desktop exports (bills and income only) still import. Bills marked "financed" in older data move to Loans automatically, keeping their payment history. Anything they don't contain, like budgets, cards and payment history, is kept.

## Expo Go limitations

Everything runs in Expo Go except:
- **Face ID** needs the installed app on iOS. Fingerprint works in Expo Go on Android.
- **The custom "Bill reminders" notification channel** on Android: Expo Go falls back to its default channel.
