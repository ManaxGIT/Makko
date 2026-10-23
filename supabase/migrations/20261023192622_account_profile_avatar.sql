-- Immutable uploads: replacing/removing a profile photo changes the reference.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-avatars','profile-avatars',false,10485760,array['image/jpeg','image/png','image/webp']);

create or replace function private.can_read_profile_avatar(object_path text)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null
    and exists(select 1 from public.profiles where id=auth.uid() and account_status='active')
    and (split_part(object_path,'/',1)=auth.uid()::text
      or exists(select 1 from public.profiles where avatar_path=object_path and account_status='active'));
$$;
revoke all on function private.can_read_profile_avatar(text) from public,anon;
grant execute on function private.can_read_profile_avatar(text) to authenticated;
create policy profile_avatar_upload on storage.objects for insert to authenticated with check (
  bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists(select 1 from public.profiles where id=(select auth.uid()) and account_status='active')
);
create policy profile_avatar_read on storage.objects for select to authenticated using (
  bucket_id='profile-avatars' and private.can_read_profile_avatar(name)
);
-- No client UPDATE/DELETE: a current image cannot disappear while being saved.
revoke update(avatar_path) on public.profiles from authenticated;

create or replace function private.update_account_profile(
  profile_name text, profile_phone text, profile_bio text, profile_avatar text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); p public.profiles; normalized_avatar text:=nullif(btrim(profile_avatar),'');
begin
  if caller is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into p from public.profiles where id=caller and account_status='active' for update;
  if p.id is null then raise exception 'active_profile_required' using errcode='42501'; end if;
  if profile_name is null or char_length(btrim(profile_name)) not between 2 and 80
    or char_length(profile_bio)>500 or char_length(profile_phone)>32 then
    raise exception 'invalid_profile' using errcode='22023';
  end if;
  if normalized_avatar is not null and normalized_avatar is distinct from p.avatar_path then
    if split_part(normalized_avatar,'/',1)<>caller::text or not exists(
      select 1 from storage.objects where bucket_id='profile-avatars' and name=normalized_avatar
      and owner_id=caller::text
      and metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')
      and (metadata->>'size')::bigint between 1 and 10485760
    ) then raise exception 'invalid_avatar' using errcode='22023'; end if;
  end if;
  update public.profiles set display_name=btrim(profile_name),phone=nullif(btrim(profile_phone),''),
    bio=nullif(btrim(profile_bio),''),avatar_path=normalized_avatar where id=caller returning * into p;
  return jsonb_build_object('display_name',p.display_name,'phone',p.phone,'bio',p.bio,'avatar_path',p.avatar_path);
end $$;
revoke all on function private.update_account_profile(text,text,text,text) from public,anon;
grant execute on function private.update_account_profile(text,text,text,text) to authenticated;
create or replace function public.update_account_profile(
  profile_name text, profile_phone text, profile_bio text, profile_avatar text
)
returns jsonb language sql security invoker set search_path='' as $$
  select private.update_account_profile(profile_name,profile_phone,profile_bio,profile_avatar);
$$;
revoke all on function public.update_account_profile(text,text,text,text) from public,anon;
grant execute on function public.update_account_profile(text,text,text,text) to authenticated;
