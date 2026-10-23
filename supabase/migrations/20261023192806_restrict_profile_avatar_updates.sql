-- Supabase project defaults may grant table-wide UPDATE, overriding column revokes.
revoke update on public.profiles from anon, authenticated;
revoke update(avatar_path) on public.profiles from anon, authenticated;
grant update(display_name, phone, bio) on public.profiles to authenticated;
