-- ===========================================================================
-- Wishlist items: bring back the external product URL.
--
-- 0004 dropped this column reasoning "the image carries the visual" — but the
-- image only shows *what*, not *where*. Owners kept wanting to point gifters at
-- the exact product page (right variant, correct size, in-stock URL), so we
-- add it back as an optional field. Nullable; the UI treats an empty value as
-- "no link" and only renders the icon when a URL is present.
-- ===========================================================================

alter table public.wishlist_items
  add column if not exists url text;
