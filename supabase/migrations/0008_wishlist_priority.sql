-- ===========================================================================
-- Wishlists: mirror the item-priority collapse (migration 0007) onto the
-- parent `wishlists.position` column.
--
-- The wishlist form exposed a free-form integer labelled "Priority" that
-- users treated as a rank; we collapse it to the same discrete 1 (Low) /
-- 2 (Medium) / 3 (High) scale as items, rendered with the same lightning
-- picker in the form.
--
-- Existing rows are snapped to High so the current visible ordering
-- doesn't change under owners' feet.
-- ===========================================================================

update public.wishlists set position = 3;

alter table public.wishlists
  alter column position set default 3,
  add constraint wishlists_position_priority_ck
    check (position in (1, 2, 3));
