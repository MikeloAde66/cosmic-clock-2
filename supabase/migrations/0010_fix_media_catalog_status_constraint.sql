-- Fixes a live-database mismatch discovered while testing the new
-- POST /api/v1/media/catalog/status endpoint: the live check constraint
-- on media_catalog.status only accepts 'active' — 'archived' is rejected
-- outright (error 23514), despite 0006/0007 both specifying
-- `check (status in ('active', 'archived'))`. Verified directly: probing
-- 'active', 'archived', 'ACTIVE', and 'inactive' as insert values, only
-- 'active' was accepted. Same class of issue as 0002/0004/0007/0009 —
-- the SQL that actually ran doesn't match the migration file.
--
-- Unlike those earlier fixes, this table now holds real rows (X Minus One,
-- Computer Chronicles), so this alters the constraint in place rather
-- than dropping/recreating the table.

alter table public.media_catalog drop constraint if exists media_catalog_status_check;

alter table public.media_catalog
  add constraint media_catalog_status_check check (status in ('active', 'archived'));
