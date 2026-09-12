# Makko mobile

Universal Expo application for Android, iOS, and web.

## Structure

- `app/`: Expo Router routes and layouts.
- `src/components/`: reusable UI and feature components.
- `src/features/`: domain modules such as auth, requests, chat, receipts, and reviews.
- `src/services/`: API, Supabase Auth, Realtime, Storage, maps, and notifications.
- `src/store/`: local client state.
- `src/lib/`, `src/hooks/`, `src/types/`: shared application utilities.
- `assets/`: static images and icons.

## Run locally

```bash
npm install
npm start
```

Run `npm run typecheck` before committing UI changes.

## Authentication setup

Copy `.env.example` to `.env` and provide the project URL and publishable key.
In Supabase Auth, enable the Google provider and add `makko://**` to the redirect
URL allow list. Google Cloud must use the Supabase callback URL shown on the
provider page as an authorized redirect URI.

## Shared bottom navigation

All primary screens live under `app/(tabs)/`. The group layout configures the
tab navigator once, and `src/components/navigation/AppTabBar.tsx` owns the
shared bottom navigation UI. Add a route to the group and register it in the
layout; do not create a separate bottom bar inside individual screens.
