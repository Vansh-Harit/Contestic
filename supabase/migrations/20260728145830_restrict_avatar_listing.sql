-- Avatars remain publicly retrievable through the public bucket URL. Removing
-- the SELECT policy prevents clients from enumerating all object names.
drop policy if exists "Anyone can view avatars" on storage.objects;
