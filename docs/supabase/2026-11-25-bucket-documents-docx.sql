-- El bucket `documents` solo admitía application/pdf, pero el EETT/TDR de una
-- necesidad acepta también Word (.docx) desde que el área usuaria puede subir
-- lo que redacta sin imprimirlo a PDF. Storage rechazaba el .docx con
-- `415 invalid_mime_type` y la subida fallaba siempre, fuese cual fuese el
-- tamaño del fichero.
--
-- Idempotente: no duplica el mime si ya está.
update storage.buckets
set allowed_mime_types = array_append(
  allowed_mime_types,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
)
where id = 'documents'
  and allowed_mime_types is not null
  and not (
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    = any (allowed_mime_types)
  );

-- Comprobación: debe listar los dos mimes.
select id, allowed_mime_types from storage.buckets where id = 'documents';
