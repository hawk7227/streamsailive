begin;

grant usage on schema streams to service_role;

do $$
begin
  if to_regclass('streams.streams_ai_previews') is not null then
    execute 'grant select, insert, update, delete on table streams.streams_ai_previews to service_role';
  end if;

  if to_regclass('streams.streams_ai_preview_versions') is not null then
    execute 'grant select, insert, update, delete on table streams.streams_ai_preview_versions to service_role';
  end if;
end
$$;

grant usage, select on all sequences in schema streams to service_role;

alter default privileges in schema streams
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema streams
  grant usage, select on sequences to service_role;

commit;
