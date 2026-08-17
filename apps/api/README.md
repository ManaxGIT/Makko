# Makko API

FastAPI application responsible for business workflows, authorization checks,
and integrations that should not run in the public client.

## Structure

- `app/api/v1/endpoints/`: HTTP route handlers.
- `app/core/`: settings, security, logging, and application-wide concerns.
- `app/dependencies/`: FastAPI dependency providers.
- `app/models/`: internal domain or persistence models.
- `app/schemas/`: Pydantic request and response schemas.
- `app/services/`: business use cases.
- `app/repositories/`: database access boundaries.
- `tests/unit/`: isolated business tests.
- `tests/integration/`: API and database integration tests.

The API should not duplicate database invariants already enforced transactionally
by PostgreSQL. Its exact boundary with Supabase RPCs must be documented before
feature implementation.

