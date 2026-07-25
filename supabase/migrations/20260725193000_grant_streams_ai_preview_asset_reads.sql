begin;

grant usage on schema streams to service_role;

grant select, insert, update, delete
on table streams.streams_ai_preview_assets
to service_role;

grant select, insert, update, delete
on table streams.streams_ai_assets
to service_role;

grant usage, select, update
on all sequences in schema streams
to service_role;

commit;
