-- Stage 23: receipts (קבלה) and delivery notes (תעודת משלוח) as printable
-- order documents, each with a sequential per-business number.
--
-- Israeli bookkeeping requires receipt / delivery-note numbers to be
-- sequential, unique, and never reused within the business. Numbers come
-- from a per-(business, doc_type) counter taken atomically, so two admins
-- printing at once can never get the same number. The series starts at
-- 1001.

-- Allow the two new document types.
alter table public.order_documents
  drop constraint if exists order_documents_doc_type_check;
alter table public.order_documents
  add constraint order_documents_doc_type_check
    check (doc_type in ('quote', 'receipt', 'delivery_note'));

-- The document's official number (null for quotes, which are not numbered).
alter table public.order_documents
  add column if not exists doc_number bigint;

-- A number is unique within its series (business + doc type).
create unique index if not exists order_documents_doc_number_key
  on public.order_documents (business_id, doc_type, doc_number)
  where doc_number is not null;

-- ── Per-business, per-type document number counters ──
create table if not exists public.document_number_counters (
  business_id uuid not null references public.businesses (id) on delete cascade,
  doc_type    text not null,
  next_number bigint not null default 1001,
  primary key (business_id, doc_type)
);

alter table public.document_number_counters enable row level security;
create policy "business members full access"
  on public.document_number_counters for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

-- Atomically takes the next number in the series (first call returns 1001).
create or replace function public.take_document_number(
  p_business_id uuid,
  p_doc_type text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number bigint;
begin
  insert into document_number_counters (business_id, doc_type, next_number)
  values (p_business_id, p_doc_type, 1002)
  on conflict (business_id, doc_type)
    do update set next_number = document_number_counters.next_number + 1
  returning next_number - 1 into v_number;
  return v_number;
end;
$$;
