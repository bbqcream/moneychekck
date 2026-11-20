create table public.payplan_documents (
  user_id uuid primary key references auth.users (id) on delete cascade,
  revision integer not null check (revision > 0),
  mutation_id text not null check (char_length(mutation_id) between 1 and 64),
  document jsonb not null check (
    jsonb_typeof(document) = 'object'
    and document @> '{"version": 1}'::jsonb
    and coalesce(jsonb_typeof(document -> 'scenarios') = 'array', false)
  )
);

alter table public.payplan_documents enable row level security;

revoke all on table public.payplan_documents from anon, authenticated;
grant select, insert, update on table public.payplan_documents to authenticated;

create policy "Read own Payplan"
  on public.payplan_documents for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Create own Payplan"
  on public.payplan_documents for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Update own Payplan"
  on public.payplan_documents for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
