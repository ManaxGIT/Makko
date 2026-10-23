# Makko project instructions

`AGENTS.md` is the authoritative source of working instructions for agents in
this repository. Follow it before any project note, README, inferred roadmap, or
previous-session assumption.

`product-schema-notes.md` is primarily a human-readable notebook for the project
owner. Agents may read it for additional context, but must not treat it as a
roadmap, a source of task priority, or authorization to implement follow-up work.
Do not expand the current request merely because the note contains proposals or
unchecked items. Only update the note when the user explicitly asks, or when the
current task specifically requires maintaining that documentation.

Preserve existing notes unless the requested task directly changes them. When a
note must be edited, clearly separate verified current behavior from proposals
and temporary prototype compromises.

## Design authority and change control

- Preserve the repository's existing architecture, naming, data flow, UI
  patterns, and dependency choices. Prefer the smallest change that satisfies
  the user's explicit request.
- Do not invent product requirements, user flows, endpoints, database entities,
  fields, abstractions, services, dependencies, design-system rules, or future
  work unless the user explicitly asks for a proposal or implementation.
- Do not treat an example, unchecked TODO, mock value, speculative note, or
  previous agent suggestion as an approved design decision.
- Before introducing or changing a public contract—including API routes,
  request/response bodies, database schema, authentication behavior, navigation,
  or shared component APIs—first verify an approved pattern already exists. If
  no approved pattern exists and the choice would materially affect the design,
  stop and ask the user to decide.
- When several implementations satisfy the request, use the option most
  consistent with existing code. Do not perform unrelated cleanup, refactoring,
  renaming, redesign, or dependency replacement without explicit permission.
- A request to analyze, explain, inspect, or recommend is read-only. It does not
  authorize implementation. Clearly label suggestions as proposals and wait for
  approval before applying them.
- If the user's new instruction conflicts with an existing project convention,
  explain the conflict and obtain confirmation before changing the convention.
  The user's explicit decision then becomes authoritative and should be recorded
  in this file only when it is a durable instruction for future agents.

## Adding notes

- Put durable instructions that future agents must remember in `AGENTS.md`.
- Do not add notes, TODOs, implementation summaries, or development directions to
  `product-schema-notes.md` unless the user explicitly asks for that file to be
  updated.
- Put code-specific TODOs next to the relevant code, and put setup or usage
  information in the appropriate README or technical documentation.
- Do not create a new note file when an existing authoritative location is
  appropriate.

Do not claim an authentication path works end-to-end unless both the client code
and the corresponding Supabase provider/configuration have been verified.

## Mobile application

- The mobile client lives in `apps/mobile` and uses Expo, React Native,
  TypeScript, and Expo Router. Implement mobile UI with React Native primitives
  and `StyleSheet`; do not introduce web-only HTML, CSS, or Tailwind patterns.
- Reuse `apps/mobile/src/theme/colors.ts` and
  `apps/mobile/src/theme/typography.ts`. Do not hardcode content font families,
  font sizes, line heights, or label/eyebrow letter spacing inside screens when
  an appropriate shared token exists.
- The active typography is Be Vietnam Pro for body copy and Lora for display
  headings. Noto Sans remains installed as an alternative for comparison; do
  not remove an installed font option unless the user explicitly asks.
- Reuse `apps/mobile/src/components/auth/AuthUI.tsx` for authentication headers,
  fields, buttons, branding, and screen scaffolding. Extend the shared component
  when a change should apply to multiple authentication screens.
- The bottom navigation is implemented once in
  `apps/mobile/src/components/navigation/AppTabBar.tsx` and is mounted by
  `apps/mobile/app/(tabs)/_layout.tsx`. Never create per-screen copies of the tab
  bar. Keep its background flush with the physical bottom edge while preserving
  usable spacing around device gesture indicators.
- Continue to account for iPhone and Android safe areas. A screen should not add
  a second bottom inset when its navigator or shared navigation component
  already owns that inset.

## Authentication and Supabase

- The application data boundary is `apps/mobile -> apps/api (FastAPI) ->
  Supabase`. Mobile feature code must not query Supabase tables or non-auth RPCs
  directly. The mobile Supabase client is reserved for Auth session management,
  Realtime, and Storage flows that are explicitly designed for client access.
- Put HTTP endpoints in `apps/api/app/api/v1/endpoints`, response/request DTOs in
  `app/schemas`, business orchestration in `app/services`, and Supabase access in
  `app/repositories`. Never expose `SUPABASE_SECRET_KEY` through an
  `EXPO_PUBLIC_*` variable or commit it.
- Keep concurrency-sensitive database transactions such as `accept_request`,
  `publish_request`, and valid request status transitions as PostgreSQL RPCs.
  Invoke those RPCs from FastAPI endpoints; do not reimplement their transaction
  invariants as several application-side queries.

- The shared Supabase client is `apps/mobile/src/lib/supabase.ts`; authentication
  session state is owned by `apps/mobile/src/features/auth/AuthProvider.tsx`.
  Reuse these modules instead of creating additional clients or parallel session
  stores.
- Routes under `apps/mobile/app/(tabs)` are session-protected by the tabs layout.
  Preserve that route guard when adding or reorganizing authenticated screens.
- Mobile environment variables are `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `EXPO_PUBLIC_API_URL`. Keep placeholders in
  `apps/mobile/.env.example`, keep real values only in the ignored
  `apps/mobile/.env`, and never place a Supabase service-role key in a mobile or
  other `EXPO_PUBLIC_*` variable.
- Physical phones are the default mobile test target. Run FastAPI on
  `0.0.0.0:8000` and configure `EXPO_PUBLIC_API_URL` with the development
  computer's current LAN IP; do not use `localhost` for a physical device.
- Treat the current authentication screens and client calls separately from
  Supabase dashboard configuration. Verify the relevant provider, redirect URLs,
  database trigger/profile behavior, and a real device or simulator flow before
  describing authentication as working end-to-end.

## Saved delivery addresses

- Saved account addresses may omit coordinates (user decision, 2026-10-21).
  Latitude and longitude must either both be present or both be null. Do not
  substitute zeroes or administrative centroids for missing coordinates.
- Saving a default address is independent of publishing or saving a draft order.
  Restore it from the authenticated account on later visits.
- Request publication also permits missing coordinates (user decision, 2026-10-21).
  Coordinate-dependent features are deferred; do not block posting on geolocation
  or fabricate distances. Preserve atomic creation/publication and owner checks.

## Maps and distance

- User decision (2026-10-23): Google Maps integration is temporarily paused.
  Do not load the map picker or enable its config plugin until the user resumes it.
  Keep manual address entry and optional current-device GPS coordinates.
  Reverse geocoding is deferred; do not use Google Geocoding to convert coordinates
  to address text. Users enter address text manually, independently of the map pin.

## Figma implementation

- Use a design-first workflow for new UI requests. When the user asks to
  "create/design a UI" and has not supplied an approved Figma node, first create
  or update a browser-renderable prototype under `design/figma-import/` so it can
  be reviewed and imported into Figma. Verify that prototype visually before
  treating the design as ready.
- Do not implement a newly proposed UI in `apps/mobile` during that first design
  step unless the user explicitly asks for both the Figma-importable design and
  the mobile implementation, or confirms that the prototype is approved and
  asks to implement it.
- A request to implement an existing supplied Figma node is already an approved
  design-to-code request; in that case, inspect the node and implement it in the
  mobile app without creating a redundant HTML prototype first.
- The current mobile Explore screen is an explicitly accepted implementation.
  Preserve it; the design-first rule applies to future UI work and does not
  authorize reverting or replacing that screen.
- When implementing a supplied Figma node, inspect that exact node and its child
  frames, then adapt the design to the existing Expo/React Native architecture.
  Figma-generated React/Tailwind output is reference material, not code to paste
  into this project.
- Prefer existing shared components and theme tokens. If the same navigation,
  form control, header, or layout appears on multiple screens, implement it once
  in the appropriate shared component directory.
- Preserve the visual hierarchy and behavior from Figma while using the active
  project typography and safe-area rules unless the user explicitly requests a
  design-system change.

## Verification

- After changing mobile TypeScript or TSX, run `npm run typecheck` from
  `apps/mobile`.
- For multi-screen, navigation, font-loading, or layout changes, also run an Expo
  export or the relevant platform build when practical. Report separately what
  was statically verified and what was actually exercised on a device, simulator,
  browser, or configured Supabase project.

## Purchase agreement and evidence

- User decision (2026-10-22): orders use a fixed goods amount plus a separate
  errand fee. When buying the full, correct order, the shopper keeps savings and
  bears overruns; do not recalculate customer payment from actual purchase cost.
- Existing orders were explicitly included in this conversion. The legacy
  `estimated_items_total` field now holds the agreed amount for compatibility;
  `actual_items_total` remains separate. Do not fabricate actual costs.
- Missing or substituted goods require customer agreement and a corresponding
  price adjustment. The adjustment workflow is not implemented; do not silently
  deduct or let a missing-item flow proceed as a fully purchased order.
- Purchase evidence uses private Storage, goods photos and optional receipt
  photos classified separately. Final item confirmation, evidence registration,
  and the shopping-to-delivering transition run in one PostgreSQL transaction.

## Delivery and receipt confirmation

- User decision (2026-10-23): delivery completion requires two separate confirmations.
  Only the assigned shopper may move `delivering -> delivered`; only the customer
  may move `delivered -> completed`. Neither party may skip the other confirmation.
- `delivered` means the shopper has confirmed handoff and the order is waiting for
  the customer's receipt confirmation. It remains an active order; mark the
  assignment complete only when the customer completes the order.
- User decision (2026-10-23): shopper handoff confirmation requires at least one
  private delivery photo, classified separately from goods/receipt photos. Register
  delivery evidence and move `delivering -> delivered` in one PostgreSQL RPC;
  do not allow a status-only call to bypass the photo requirement.

## Order chat

- User decisions (2026-10-23): chat opens as soon as a shopper accepts a request,
  including before shopping starts. Completed or cancelled orders are read-only.
- Releasing an accepted assignment deletes the old conversation history; a later
  shopper starts a fresh conversation. Do not expose old messages to a new shopper.
- Chat reads/writes go through FastAPI. Realtime only signals that the client should
  reload through the API. Sending must atomically verify the current assignment and
  order status, serialized with release and status transitions.

## Order lists and deletion

- User decision (2026-10-23): the Orders tab separates active orders by role:
  posted requests (`customer`) and accepted requests (`shopper`). Completed and
  cancelled orders are accessed through Account → Order history.
- Deleting a posted request uses the existing cancellation transition, retains
  its history, and is allowed only for the owner before acceptance (draft/open).
  Preserve database serialization with acceptance: a cancelled request cannot be
  accepted, and an accepted request cannot be removed through this action.

## Data loading and refresh experience

- User decision (2026-10-23): preserve already-loaded content when returning to
  a screen or refreshing data. Full-screen loading is for the initial load when
  no usable result exists; a successfully loaded empty list is usable data.
- Do not unconditionally refetch on every navigation focus. Reuse cached data
  while fresh and refresh stale or invalidated data in the background without
  clearing the screen, selection, or scroll position unnecessarily. Order lists
  currently use a 30-second freshness interval; choose other intervals according
  to the feature's actual needs rather than applying this value universally.
- After a confirmed mutation, update affected local/cached data when its effect
  is known instead of reloading the entire list. Successful order deletion removes
  the item locally. Invalidate related data when authoritative details are still
  needed; do not fabricate missing server values or bypass server validation.
- Provide pull-to-refresh for lists that need manual refresh. Keep usable content
  visible on background errors and offer a retry without replacing it with an
  error screen. Distinguish initial loading, background fetching, and manual refresh.
- Deduplicate concurrent reads of the same query. Reject obsolete responses so
  they cannot overwrite newer searches or mutations, or resurrect removed items.
  Scope caches by account and query parameters; clear them on logout/account change
  and prevent in-flight responses from restoring data after clearing.
- Preserve necessary live updates for chat and order tracking in the background,
  with subscription/timer cleanup. Reducing requests must not hide status changes
  or weaken ownership, cancellation, and acceptance checks on the server.
- Reuse the existing cache implementation and auth owner before adding another
  mechanism or dependency. When available, use the `preserve-data-on-refresh`
  skill for implementation guidance; this file remains the project's authority.
