-- ===========================================================================
-- Wishlist items: drop the external Product URL, replace the
-- wishlist_item_images side-table with an inline `images text[]` array.
--
-- Why the shape change:
-- * The "Product URL" field overlapped with the image: the card just needs an
--   image; the external store link added little. Drop the column outright.
-- * The images side-table (introduced in 0003) was over-engineered for a hard
--   cap of 3 ordered urls. The form now uploads each image to R2 *before*
--   submit and just sends back the urls — so the create/update transaction is
--   already atomic on the array, and there's no need for a separate table.
-- * The cron task that prunes orphan R2 objects still works: it now diffs the
--   set of objects under `wishlist/` against the URLs collected from every row
--   in `wishlist_items.images`.
-- ===========================================================================

-- 1. drop the product URL
alter table public.wishlist_items
  drop column if exists url;

-- 2. drop the images side-table (0003) — nothing to migrate (it was empty)
drop trigger if exists wishlist_item_images_cap on public.wishlist_item_images;
drop function if exists public.enforce_item_image_cap();
drop table if exists public.wishlist_item_images;

-- 3. inline images array; max 3 enforced by a CHECK constraint
alter table public.wishlist_items
  add column if not exists images text[] not null default '{}'::text[];

alter table public.wishlist_items
  drop constraint if exists wishlist_items_images_max_3;
alter table public.wishlist_items
  add constraint wishlist_items_images_max_3
  check (cardinality(images) <= 3);
