-- No actual account edits or Storage metadata survive this test.
begin;
do $$
declare
  owner uuid; other uuid; original public.profiles; after_row public.profiles;
  own_path text; other_path text; bad_path text; result jsonb; affected integer;
begin
  select * into original from public.profiles where account_status='active' order by id limit 1;
  owner:=original.id;
  select id into other from public.profiles where account_status='active' and id<>owner order by id limit 1;
  if other is null then raise exception 'Requires two profiles'; end if;
  own_path:=owner::text||'/'||gen_random_uuid()::text||'.jpg';
  other_path:=other::text||'/'||gen_random_uuid()::text||'.jpg';
  bad_path:=owner::text||'/'||gen_random_uuid()::text||'.jpg';
  insert into storage.objects(bucket_id,name,owner_id,metadata) values
    ('profile-avatars',own_path,owner::text,'{"size":128,"mimetype":"image/jpeg"}'),
    ('profile-avatars',other_path,other::text,'{"size":128,"mimetype":"image/jpeg"}'),
    ('profile-avatars',bad_path,owner::text,'{"size":128,"mimetype":"text/html"}');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.update_account_profile('Test',null,null,null);
    raise exception 'FAIL anonymous update';
  exception when insufficient_privilege then if sqlerrm<>'authentication_required' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',owner::text,true);
  begin
    insert into storage.objects(bucket_id,name,owner_id,metadata) values('profile-avatars',other::text||'/'||gen_random_uuid()::text||'.jpg',owner::text,'{"size":128,"mimetype":"image/jpeg"}');
    raise exception 'FAIL upload into another account';
  exception when insufficient_privilege then null; end;
  begin
    perform public.update_account_profile(' ',null,null,null);
    raise exception 'FAIL blank name';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.update_account_profile('Test',null,repeat('a',501),null);
    raise exception 'FAIL long bio';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.update_account_profile('Test',null,null,owner::text||'/missing.jpg');
    raise exception 'FAIL missing image';
  exception when invalid_parameter_value then if sqlerrm<>'invalid_avatar' then raise; end if; end;
  begin
    perform public.update_account_profile('Test',null,null,other_path);
    raise exception 'FAIL foreign image';
  exception when invalid_parameter_value then if sqlerrm<>'invalid_avatar' then raise; end if; end;
  begin
    perform public.update_account_profile('Test',null,null,bad_path);
    raise exception 'FAIL non-image';
  exception when invalid_parameter_value then if sqlerrm<>'invalid_avatar' then raise; end if; end;
  begin
    update public.profiles set avatar_path=other_path where id=owner;
    raise exception 'FAIL direct path bypass';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',other::text,true);
  if private.can_read_profile_avatar(own_path) then raise exception 'FAIL draft image exposed'; end if;
  perform set_config('request.jwt.claim.sub',owner::text,true);
  result:=public.update_account_profile(' Profile test ','0901234567',' Hello ',own_path);
  if result->>'display_name'<>'Profile test' or result->>'bio'<>'Hello' or result->>'avatar_path'<>own_path then raise exception 'FAIL save'; end if;
  perform set_config('request.jwt.claim.sub',other::text,true);
  if not private.can_read_profile_avatar(own_path) then raise exception 'FAIL saved image unreadable'; end if;
  perform set_config('request.jwt.claim.sub',owner::text,true);
  begin
    delete from storage.objects where bucket_id='profile-avatars' and name=own_path;
    get diagnostics affected=row_count;
    if affected<>0 then raise exception 'FAIL client removed referenced image'; end if;
  exception when insufficient_privilege then null; end;
  perform public.update_account_profile('Profile test',null,null,null);
  perform set_config('request.jwt.claim.sub',other::text,true);
  if private.can_read_profile_avatar(own_path) then raise exception 'FAIL removed image still exposed'; end if;
  execute 'reset role';
  select * into after_row from public.profiles where id=owner;
  if after_row.avatar_path is not null or after_row.phone is not null or after_row.bio is not null then raise exception 'FAIL clear optional fields'; end if;
  if after_row.average_rating<>original.average_rating or after_row.rating_count<>original.rating_count then raise exception 'FAIL reputation changed'; end if;
  if not exists(select 1 from storage.buckets where id='profile-avatars' and public=false) then raise exception 'FAIL public bucket'; end if;
end $$;
rollback;
