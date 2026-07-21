-- ===========================================================================
-- Wishlist items: turn the free-form `position` sort key into a discrete
-- three-step priority.
--
-- The form previously exposed `position` as a free integer labelled
-- "Priority". Users treated it as a rank ("higher = higher on the list") but
-- the value they picked was essentially meaningless in absolute terms and
-- didn't communicate anything on the card. We collapse it to Low (1),
-- Medium (2), High (3), rendered as 1/2/3 lightning bolts in the UI.
--
-- Existing rows are snapped to High so the current visible ordering doesn't
-- change under owners' feet — every item stays "hot" until they touch it.
--
-- The composite index also grows an `is_active desc` leading term so owner
-- queries (which include hidden items) surface active items first without
-- an extra sort node.
-- ===========================================================================

-- Migrate existing values → High (3).
update public.wishlist_items set position = 3;

-- Constrain to 1/2/3; default new rows to High.
alter table public.wishlist_items
  alter column position set default 3,
  add constraint wishlist_items_position_priority_ck
    check (position in (1, 2, 3));

-- Update the composite index so `is_active desc, position desc, created_at desc, id desc`
-- is index-only.
drop index if exists public.wishlist_items_owner_order_idx;
create index wishlist_items_owner_order_idx
  on public.wishlist_items
    (owner_id, is_active desc, position desc, created_at desc, id desc);
