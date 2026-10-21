-- Hoja membretada de cada oficina: PDF con el membrete oficial que se usa como
-- portada de los documentos generados (informes, oficios, designación de
-- evaluadores A6, etc.).
--
-- Se gestiona en Configuración › Áreas › Membrete. Subir uno nuevo reemplaza
-- el anterior (no se acumulan versiones): por eso basta una ruta por oficina.
--
-- Vive en la tabla `expedientes_oficinas` (no en `entity_settings`) porque es
-- un atributo por oficina, no de la entidad. `membrete_bucket` se guarda aparte
-- para poder borrar el objeto del bucket correcto aunque la configuración global
-- cambie.
--
-- Idempotente: se puede ejecutar varias veces sin efecto.

alter table public.expedientes_oficinas
  add column if not exists membrete_path text,
  add column if not exists membrete_bucket text;

comment on column public.expedientes_oficinas.membrete_path is
  'Ruta del PDF de la hoja membretada de la oficina dentro del bucket de Storage.';
comment on column public.expedientes_oficinas.membrete_bucket is
  'Bucket de Storage donde vive el PDF membretado. Permite borrar del bucket correcto aunque la configuración global cambie.';
