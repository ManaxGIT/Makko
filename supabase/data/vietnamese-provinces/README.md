# Vietnamese administrative directory

Source: https://github.com/thanglequoc/vietnamese-provinces-database

- Release: **v5.2.0**
- Commit: `62b1abdfe39625289c37a58ef6678e9db3d37f84`
- Source files: `postgresql/postgres_CreateTables_vn_units.sql` and
  `postgresql/postgres_ImportData_vn_units.sql` at that commit.
- Source import SHA-256: `46b59e96ca105edf090005fb4e8cc6373cfb3d66e657e8d5d763f0cf5f8fbda4`.
- License: MIT, reproduced in `LICENSE`.
- Imported: 34 provinces and 3,321 wards/communes/special administrative areas.
- Migration `20261020133618_seed_vietnamese_provinces_v520.sql` projects only
  `code`, `name`, `full_name` and each ward's `province_code`; Vietnamese names
  and codes are unchanged. Codes remain strings to preserve leading zeros.

This release uses province → ward relationships. New delivery addresses do not
require a district. Legacy address text and existing order snapshots are not
rewritten or automatically matched to current codes. Future dataset upgrades
need a reviewed migration; startup never downloads or overwrites the directory.

These administrative records are not street-level geocoding. Coordinates supplied
when saving an address must represent the delivery location, not a province or
ward centroid. The API validates numeric ranges, not physical address accuracy.
