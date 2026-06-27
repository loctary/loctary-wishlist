-- ===========================================================================
-- Active / inactive wishlist items.
--
-- `is_active` is orthogonal to `status` (the reservation lifecycle). An inactive
-- item is hidden from public lists and the public item page, but the owner still
-- sees it in their own management view. This lets an owner "deactivate" instead
-- of delete — notably for a gifted (confirmed) item, which can't be deleted.
-- ===========================================================================
alter table public.wishlist_items
  add column if not exists is_active boolean not null default true;
