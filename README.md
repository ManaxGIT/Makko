# Makko

Makko is a community grocery-request platform. A user can create a shopping
request, accept another user's request, coordinate the purchase, provide a
receipt, deliver the goods, and review the other participant.

## Repository layout

```text
apps/
  mobile/       Expo + React Native application for Android, iOS, and web
  api/          FastAPI application for business workflows and integrations
packages/
  shared/       Shared contracts, constants, and framework-neutral types
supabase/       PostgreSQL migrations, local configuration, seed data, and tests
database/       Reviewable SQL design artifacts
docs/           Product, analysis, architecture, and thesis documentation
scripts/        Development and maintenance scripts
```

The current repository is in the foundation stage: product flows, diagrams,
database design, and the initial Supabase migration exist; application code
will be implemented inside `apps/`.

