-- Text chat opens at acceptance. Released assignments clear the old conversation.
alter table public.messages add column client_key uuid;
create unique index messages_retry_key_idx on public.messages(request_id,sender_id,client_key);

-- Only the atomic RPC may write, so REST cannot bypass status/assignment checks.
drop policy messages_insert_participant on public.messages;
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
revoke all on sequence public.messages_id_seq from anon, authenticated;

create or replace function private.send_order_message(
  target_request_id uuid, target_assignment_id uuid, message_body text, message_key uuid
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  caller uuid := auth.uid(); r public.shopping_requests;
  a public.request_assignments; m public.messages; normalized text := btrim(message_body);
begin
  if caller is null then raise exception 'authentication_required' using errcode='42501'; end if;
  -- Same lock as release/transition/accept: no message can race a closed or replaced assignment.
  select * into r from public.shopping_requests where id=target_request_id for update;
  select * into a from public.request_assignments
    where id=target_assignment_id and request_id=target_request_id and released_at is null;
  if r.id is null or a.id is null or caller not in (r.customer_id,a.shopper_id) then
    raise exception 'chat_not_found' using errcode='42501';
  end if;
  if not exists(select 1 from public.profiles where id=caller and account_status='active') then
    raise exception 'active_profile_required' using errcode='42501';
  end if;
  if normalized is null or char_length(normalized) not between 1 and 4000
    or normalized !~ '[^[:space:]]' or message_key is null then
    raise exception 'invalid_message' using errcode='22023';
  end if;
  select * into m from public.messages
    where request_id=r.id and sender_id=caller and client_key=message_key;
  if m.id is not null then
    if m.body<>normalized then raise exception 'message_key_conflict' using errcode='22023'; end if;
  else
    if r.status not in ('accepted','shopping','delivering','delivered','disputed') or a.status<>'active' then
      raise exception 'chat_read_only' using errcode='P0001';
    end if;
    insert into public.messages(request_id,sender_id,body,client_key)
      values(r.id,caller,normalized,message_key) returning * into m;
  end if;
  return jsonb_build_object('id',m.id::text,'sender_id',m.sender_id,'body',m.body,
    'client_key',m.client_key,'created_at',m.created_at);
end $$;
revoke all on function private.send_order_message(uuid,uuid,text,uuid) from public,anon;
grant execute on function private.send_order_message(uuid,uuid,text,uuid) to authenticated;

create or replace function public.send_order_message(
  target_request_id uuid, target_assignment_id uuid, message_body text, message_key uuid
)
returns jsonb language sql security invoker set search_path='' as $$
  select private.send_order_message(target_request_id,target_assignment_id,message_body,message_key);
$$;
revoke all on function public.send_order_message(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.send_order_message(uuid,uuid,text,uuid) to authenticated;

create or replace function private.clear_released_order_messages()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  delete from public.messages where request_id=new.request_id;
  return new;
end $$;
revoke all on function private.clear_released_order_messages() from public,anon,authenticated;
create trigger clear_released_order_messages
  after update of released_at on public.request_assignments
  for each row when (old.released_at is null and new.released_at is not null)
  execute function private.clear_released_order_messages();

-- SELECT remains participant-only for Realtime, including completed-order history.
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
    and schemaname='public' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
