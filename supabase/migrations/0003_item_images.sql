-- ===========================================================================
-- Item images + priority/position consolidation.
--
-- 1. The form had two near-identical sort fields (`priority` and `position`) —
--    users couldn't tell them apart. `position` is the actual sort key (see the
--    keyset cursor + index in 0001), so we keep it and drop `priority`. The UI
--    relabels `position` as "Priority".
--
-- 2. `image_url` was a single external URL. Items now own up to three uploaded
--    images stored in R2; the canonical image set lives in `wishlist_item_images`
--    and the column is dropped. (Existing values were placeholder external URLs,
--    not R2 objects, so there is nothing worth migrating.)
--
-- The nightly orphan-cleanup worker scans this table to decide which R2 objects
-- under the `wishlist/` prefix are still referenced — store the object KEY (not
-- the URL), so the public base URL can change without rewriting rows.
-- ===========================================================================

-- 1. priority / position consolidation
alter table public.wishlist_items
  drop column if exists priority;

-- 2. drop the old single-image column
alter table public.wishlist_items
  drop column if exists image_url;

-- 3. images table
create table if not exists public.wishlist_item_images (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.wishlist_items (id) on delete cascade,
  -- R2 object key, e.g. "wishlist/<itemId>/<uuid>.webp". The public URL is
  -- derived at read time from R2_PUBLIC_BASE_URL.
  key        text not null,
  -- 0-based display order; 0 is the card cover / carousel preview.
  position   int  not null default 0 check (position >= 0 and position <= 2),
  created_at timestamptz not null default now(),
  unique (item_id, position)
);

create index if not exists wishlist_item_images_item_idx
  on public.wishlist_item_images (item_id, position);

-- Cap at 3 images per item. A unique constraint on (item_id, position) with the
-- check (position <= 2) already enforces this, but a row-level trigger gives a
-- clearer error and survives future position renumbering.
create or replace function public.enforce_item_image_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.wishlist_item_images where item_id = new.item_id) >= 3 then
    raise exception 'wishlist items may have at most 3 images';
  end if;
  return new;
end;
$$;

drop trigger if exists wishlist_item_images_cap on public.wishlist_item_images;
create trigger wishlist_item_images_cap
  before insert on public.wishlist_item_images
  for each row execute function public.enforce_item_image_cap();

-- Defense-in-depth: same as the other tables, RLS on, no policies — only the
-- service-role backend may access.
alter table public.wishlist_item_images enable row level security;
revoke execute on function public.enforce_item_image_cap() from anon, authenticated, public;
