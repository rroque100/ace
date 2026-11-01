begin;
alter table public.legal_official_sources add column if not exists cursor_url text;
alter table public.legal_update_candidates add column if not exists publication_url text;
alter table public.legal_update_candidates add column if not exists publication_date date;
alter table public.legal_update_candidates add column if not exists document_number text;
alter table public.legal_update_candidates add column if not exists detected_type text;
alter table public.legal_update_candidates add column if not exists summary text;
create unique index if not exists legal_update_one_running on public.legal_update_runs(source_id) where status='running';
commit;
