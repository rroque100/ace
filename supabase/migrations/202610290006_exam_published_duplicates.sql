begin;
alter table public.exam_questions add column prompt_fingerprint text generated always as (md5(lower(regexp_replace(trim(prompt),'\s+',' ','g')))) stored;
create unique index exam_no_duplicate_published_prompt on public.exam_questions(curriculum_version,prompt_fingerprint) where status='published' and curriculum_version is not null;
commit;
