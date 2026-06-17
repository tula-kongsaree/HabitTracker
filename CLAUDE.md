# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npx expo start          # start dev server (scan QR with Expo Go on iOS)
npx expo start --web    # run in browser
npm run lint            # ESLint
npm run reset-project   # moves app/ to app-example/ for a clean slate
```

There are no automated tests in this project.

## Architecture

**Expo SDK 54** project using **Expo Router v6** (file-based routing). Targets the App Store version of Expo Go — do not upgrade to SDK 55+ without also updating the Expo Go installation, as the App Store version only supports SDK 54.

### Routing

`app/_layout.tsx` is the root — it wraps everything in `HabitsProvider` and `ThemeProvider`. Tab screens live under `app/(tabs)/`: `index.tsx` (Today) and `explore.tsx` (Streaks). The tab bar is configured in `app/(tabs)/_layout.tsx` using `expo-router`'s `Tabs` component.

### State / persistence

`context/habits-context.tsx` holds all habit state via React Context + `@react-native-async-storage/async-storage`. It exports:
- `HabitsProvider` — wrap at root
- `useHabits()` — returns `{ habits, addHabit, removeHabit, toggleToday }`
- `getStreak(habit)` — pure function, counts consecutive days ending today (or yesterday if today not yet done)
- `localDateKey(date?)` — returns `YYYY-MM-DD` in the device's local timezone

### Theming

`constants/theme.ts` exports `Colors` (light/dark palettes with `text`, `background`, `tint`, `icon`, `tabIconDefault`, `tabIconSelected`) and `Fonts`. Screens call `useColorScheme()` directly and index into `Colors[scheme]`. There is no wrapper hook — derive card/surface colors inline (e.g. `scheme === 'dark' ? '#1C1C1E' : '#F2F2F7'`).

### Icons

`components/ui/icon-symbol.ios.tsx` uses SF Symbols (native, any SF Symbol name works). `components/ui/icon-symbol.tsx` is the Android/web fallback and requires a manual mapping entry in the `MAPPING` object for each SF Symbol name used. When adding a new icon to the tab bar or elsewhere, add the SF Symbol → MaterialIcons mapping there.

### Path alias

`@/` maps to the project root (configured in `tsconfig.json`). Use it for all internal imports.
