-- ===========================================================================
-- 0005_wishlists.sql — introduce `wishlists` as first-class objects.
--
-- Before this migration every user had exactly one implicit wishlist (their
-- items were addressed by `owner_id` only). This migration adds a `wishlists`
-- table, gives every existing owner a default list, and points existing items
-- at it. `wishlist_items.owner_id` is kept as a cheap authorization key; a
-- trigger enforces that it always matches `wishlists.owner_id` so the two
-- columns can't drift.
--
-- Roll-out is designed to be non-breaking:
--   1. add `wishlists` table
--   2. add `wishlist_items.wishlist_id` NULLABLE
--   3. backfill one "My wishlist" per distinct owner
--   4. set `wishlist_id` NOT NULL + FK cascade
-- Between (1) and (4) the old server code (which never reads `wishlist_id`)
-- keeps working, so this migration can be applied before the app deploy.
-- ===========================================================================

-- --- wishlists --------------------------------------------------------------
create table if not exists public.wishlists (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users (id) on delete cascade,
  title           text not null,
  description     text,
  cover_image_url text,
  is_active       boolean not null default true,
  position        int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists wishlists_owner_order_idx
  on public.wishlists (owner_id, position desc, created_at desc, id desc);

drop trigger if exists wishlists_touch_updated_at on public.wishlists;
create trigger wishlists_touch_updated_at
  before update on public.wishlists
  for each row execute function public.touch_updated_at();

-- RLS: same defense-in-depth as `wishlist_items` — backend uses service_role.
alter table public.wishlists enable row level security;

-- --- wishlist_items.wishlist_id (nullable → backfill → NOT NULL) ------------
alter table public.wishlist_items
  add column if not exists wishlist_id uuid references public.wishlists (id) on delete cascade;

-- Backfill: for every distinct existing owner that has items but no list yet,
-- create one default "My wishlist" and repoint all their items at it. Runs
-- once — subsequent applies are no-ops because the outer `where wishlist_id is
-- null` is empty.
do $$
declare rec record;
declare new_list uuid;
begin
  for rec in
    select distinct owner_id
    from public.wishlist_items
    where wishlist_id is null
  loop
    insert into public.wishlists (owner_id, title)
    values (rec.owner_id, 'My wishlist')
    returning id into new_list;

    update public.wishlist_items
      set wishlist_id = new_list
      where owner_id = rec.owner_id
        and wishlist_id is null;
  end loop;
end;
$$;

alter table public.wishlist_items
  alter column wishlist_id set not null;

create index if not exists wishlist_items_wishlist_order_idx
  on public.wishlist_items (wishlist_id, position desc, created_at desc, id desc);

-- --- consistency trigger ----------------------------------------------------
-- Items and lists both carry `owner_id`; enforce they never drift. This lets
-- the backend keep authorising by item.owner_id (cheap) without risking an
-- item that's owned by A but sits on B's list.
create or replace function public.enforce_item_owner_matches_list()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_list_owner uuid;
begin
  select owner_id into v_list_owner
    from public.wishlists
    where id = new.wishlist_id;
  if v_list_owner is null then
    raise exception 'wishlist % not found', new.wishlist_id;
  end if;
  if v_list_owner <> new.owner_id then
    raise exception 'wishlist_items.owner_id (%) must match wishlists.owner_id (%)',
      new.owner_id, v_list_owner;
  end if;
  return new;
end;
$$;

drop trigger if exists wishlist_items_owner_matches_list on public.wishlist_items;
create trigger wishlist_items_owner_matches_list
  before insert or update of wishlist_id, owner_id on public.wishlist_items
  for each row execute function public.enforce_item_owner_matches_list();

revoke execute on function public.enforce_item_owner_matches_list()
  from anon, authenticated, public;
