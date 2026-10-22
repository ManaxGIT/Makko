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

Copy `.env.example` to `.env` and provide the project URL, publishable key, and
the FastAPI base URL through `EXPO_PUBLIC_API_URL`. Physical-device development
is the default: use the computer's LAN IP rather than `localhost`, and keep the
phone and computer on the same Wi-Fi network.
In Supabase Auth, enable the Google provider and add `makko://**` to the redirect
URL allow list. Google Cloud must use the Supabase callback URL shown on the
provider page as an authorized redirect URI.

Authentication implementation status, temporary verification behavior, and
production follow-ups are tracked in the repository's `product-schema-notes.md`.

## Data API boundary

Feature data is loaded through FastAPI in `apps/api`; mobile must not call
Supabase tables or read-only database RPCs directly. The shared Supabase client
remains responsible for authentication sessions, and its access token is attached
to FastAPI requests by `src/lib/api.ts`.

## Shared bottom navigation

All primary screens live under `app/(tabs)/`. The group layout configures the
tab navigator once, and `src/components/navigation/AppTabBar.tsx` owns the
shared bottom navigation UI. Add a route to the group and register it in the
layout; do not create a separate bottom bar inside individual screens.

## Purchase evidence

`requests/[id]/evidence` uses `expo-image-picker` for camera and gallery access.
Rebuild the development client after installing this native dependency (for
example `npx expo run:ios`); restarting Metro alone does not add native modules.
Photos upload to the private `purchase-evidence` bucket with the signed-in
session. Metadata and final submission go through FastAPI. Camera permissions
and real photo uploads still need physical-device verification.
