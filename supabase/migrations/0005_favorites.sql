-- Top 4 favorites (PRODUCT_BLUEPRINT §2.D, the Letterboxd "4 favorites" pull):
-- the user's four defining albums, pinned to their profile. Stored on the
-- profiles row as ordered item ids; art resolves against the items table /
-- the owner's ranked list client-side.

alter table public.profiles
  add column favorites text[] not null default '{}';
