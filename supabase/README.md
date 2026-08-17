# Supabase

Supabase owns authentication, PostgreSQL data, Storage metadata, and Realtime
data access for Makko.

- `migrations/`: versioned database migrations.
- `tests/`: SQL tests for constraints, RPCs, concurrency, grants, and RLS.
- `seed.sql`: local-only development seed data.

The SQL files in `database/` remain reviewable design artifacts. Applied schema
changes must be represented by migrations in this directory.

