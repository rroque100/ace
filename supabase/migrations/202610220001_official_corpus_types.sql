begin;
alter table public.documents drop constraint if exists documents_document_type_check;
alter table public.documents add constraint documents_document_type_check check (
  document_type in ('ley','reglamento','opinion','directiva','bases_integradas','resolucion',
    'contrato','expediente','otros','acuerdo_sala_plena','pronunciamiento',
    'informe_vicio_nulidad','bases_estandar','guia_instructivo')
);
commit;
