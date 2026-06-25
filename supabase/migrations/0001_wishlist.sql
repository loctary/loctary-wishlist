-- ===========================================================================
-- loctary-wishlist schema: profiles (roles) + wishlist_items.
--
-- Access model: the Hono backend (apps/server) talks to Supabase with the
-- service-role key and performs its own authorization (requireUser /
-- requireAdmin). RLS is enabled below as defense-in-depth — it denies all
-- direct anon/authenticated access, so the data is only reachable through the
-- backend. The service-role key bypasses RLS.
-- ===========================================================================

-- --- profiles ---------------------------------------------------------------
-- One row per auth user, carrying their role. Auto-created on signup by the
-- trigger below.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         text not null default 'user' check (role in ('user', 'admin')),
  display_name text,
  created_at   timestamptz not null default now()
);

-- Backfill any existing users that predate this table.
insert into public.profiles (id)
select u.id from auth.users u
on conflict (id) do nothing;

-- Auto-create a profile whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --- wishlist_items ---------------------------------------------------------
create table if not exists public.wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  description text,
  url         text,
  image_url   text,
  price       numeric(12, 2),
  currency    text not null default 'USD',
  priority    int  not null default 0,
  position    int  not null default 0,
  status      text not null default 'available'
                check (status in ('available', 'reserved', 'confirmed', 'declined')),
  reserved_by uuid references auth.users (id) on delete set null,
  reserved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Keyset pagination order: owner's list, by position then recency.
create index if not exists wishlist_items_owner_order_idx
  on public.wishlist_items (owner_id, position desc, created_at desc, id desc);

create index if not exists wishlist_items_reserved_by_idx
  on public.wishlist_items (reserved_by);

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wishlist_items_touch_updated_at on public.wishlist_items;
create trigger wishlist_items_touch_updated_at
  before update on public.wishlist_items
  for each row execute function public.touch_updated_at();

-- --- RLS (defense-in-depth; backend uses service_role and bypasses these) ---
alter table public.profiles       enable row level security;
alter table public.wishlist_items enable row level security;
-- No policies => no direct anon/authenticated access. All reads/writes go
-- through the backend (service-role). Add policies later if a client ever needs
-- direct access.

-- The trigger functions must not be callable via the REST RPC surface; triggers
-- still fire regardless of EXECUTE grants.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.touch_updated_at() from anon, authenticated, public;

-- --- seed admin -------------------------------------------------------------
-- Promote the wishlist owner to admin. Safe to re-run.
insert into public.profiles (id, role)
values ('f5171c16-c017-4c45-90f4-9161789425c7', 'admin')
on conflict (id) do update set role = 'admin';
