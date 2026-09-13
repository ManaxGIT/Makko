# Makko project instructions

Before changing product behavior, authentication, database schema, storage,
permissions, or UI-to-database mappings, read `product-schema-notes.md` in full.

Treat `product-schema-notes.md` as the single source of truth for cross-cutting
product and schema decisions:

- Update it in the same change whenever implementation status, temporary behavior,
  unresolved constraints, or follow-up work changes.
- Put detailed product/schema/auth notes there instead of duplicating them in an
  app README. README files may link to it for setup context.
- Preserve existing notes and mark items completed only after verifying the
  corresponding UI and backend behavior.
- Clearly separate current behavior, temporary prototype compromises, and
  production follow-ups.

Do not claim an authentication path works end-to-end unless both the client code
and the corresponding Supabase provider/configuration have been verified.
