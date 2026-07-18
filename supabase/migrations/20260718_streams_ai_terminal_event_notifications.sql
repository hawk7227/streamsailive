create or replace function streams.queue_streams_ai_terminal_event_push()
returns trigger
language plpgsql
security definer
set search_path = streams, public
as $$
declare
  job_row streams.streams_ai_jobs%rowtype;
  event_title text;
  event_body text;
  deep_link text;
begin
  if new.event_type not in (
    'operation_completed','operation_failed','failed','blocked','partial_completion','cancelled',
    'preview.passed','preview.failed','verification.passed','verification.failed',
    'approval.requested','approval.approved','approval.rejected',
    'github.push.passed','github.push.failed','github.pr.created','github.merge.passed','deployment.passed'
  ) then
    return new;
  end if;

  select * into job_row from streams.streams_ai_jobs where id = new.job_id;
  if not found then return new; end if;

  event_title := case
    when new.event_type like '%failed%' or new.event_type in ('failed','blocked') then 'Streams action needs attention'
    when new.event_type = 'approval.requested' then 'Streams approval requested'
    when new.event_type like 'approval.%' then 'Streams approval updated'
    when new.event_type like 'github.%' then 'Streams repository updated'
    else 'Streams action updated'
  end;
  event_body := coalesce(nullif(new.message, ''), 'Streams reported ' || new.event_type || '.');
  deep_link := case when job_row.project_id is not null
    then '/streams-ai/streams-builder?projectId=' || job_row.project_id::text
    else '/streams-ai'
  end;

  insert into streams.streams_ai_push_deliveries (
    tenant_id, user_id, device_id, job_id, event_id, provider, event_type,
    title, body, deep_link, status, payload
  )
  select
    device.tenant_id,
    device.user_id,
    device.id,
    new.job_id,
    new.id,
    device.push_provider,
    new.event_type,
    event_title,
    left(event_body, 2000),
    deep_link,
    case when coalesce(exact.enabled, wildcard.enabled, true) then 'queued' else 'suppressed' end,
    jsonb_build_object(
      'pushToken', device.push_token,
      'projectId', job_row.project_id,
      'sequenceNumber', new.data->>'sequenceNumber'
    )
  from streams.streams_ai_devices device
  left join streams.streams_ai_notification_preferences exact
    on exact.tenant_id = device.tenant_id and exact.user_id = device.user_id
    and exact.channel = 'push' and exact.event_type = new.event_type
  left join streams.streams_ai_notification_preferences wildcard
    on wildcard.tenant_id = device.tenant_id and wildcard.user_id = device.user_id
    and wildcard.channel = 'push' and wildcard.event_type = '*'
  where device.tenant_id = new.tenant_id
    and device.user_id = new.user_id
    and device.status = 'active'
    and device.push_token is not null
    and device.push_provider is not null;

  return new;
end;
$$;

drop trigger if exists streams_ai_terminal_event_push_trigger on streams.streams_ai_job_events;
create trigger streams_ai_terminal_event_push_trigger
after insert on streams.streams_ai_job_events
for each row execute function streams.queue_streams_ai_terminal_event_push();
