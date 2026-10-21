# Capacitación del personal clave — Diseño

**Fecha:** 2026-07-28
**Módulo:** 1 · Necesidad · Ficha del requerimiento · Requisitos de calificación
**Estado:** aprobado (diseño). Falta una entrada externa: el literal de acreditación (ver §7).

## Problema

La sección «3.5.1 Requisitos de calificación» ya registra, dentro del editor
consolidado, la **experiencia del personal clave** y su **formación académica**
(Art. 72.3.b). Falta el tercer requisito de calificación del personal clave que
el formato OECE contempla: la **capacitación del personal clave** —cuántas horas,
en qué materia y para qué puesto—. Hoy no hay dónde registrarlo, así que acaba
como prosa suelta o no se registra.

## Objetivo

Añadir «Capacitación del personal clave» como un cuadro repetible análogo a
Formación académica, justo después de ella, dentro del editor de requisitos de
calificación. Cada fila compone su requisito con el texto:

> `{horas}` horas en `{materia}` del personal clave requerido como `{puesto}`.

con `[HUECO]` en mayúsculas cuando el campo está vacío, exactamente como
Formación académica compone el suyo.

## Principio rector

Es un **análogo casi exacto de Formación académica**. Se calca su estructura
(módulo puro reversible + editor cuadro + `kind` + columna oculta + tabla en el
Word). No se inventa nada nuevo salvo los tres huecos y el texto compuesto; en
particular, el literal de acreditación lo aporta el usuario (el proyecto evita
fabricar texto legal).

## 1. Módulo puro `lib/capacitacion-personal-clave.ts`

Calca [lib/formacion-academica.ts](../../../lib/formacion-academica.ts).

- Constantes de hueco, con los literales dados:
  - `HUECO_HORAS` = «CONSIGNAR LA CANTIDAD DE HORAS, HASTA UN MÁXIMO DE 120»
  - `HUECO_MATERIA` = «CONSIGNAR LA MATERIA O ÁREA DE CAPACITACIÓN, LA CUAL DEBE
    ESTAR ESPECIFICAMENTE RELACIONADA CON LAS ACTIVIDADES QUE REALIZARÁ EL
    PERSONAL CLAVE»
  - `HUECO_PUESTO` = «CONSIGNAR EL PERSONAL CLAVE REQUERIDO PARA EJECUTAR LA
    PRESTACIÓN OBJETO DE LA CONVOCATORIA RESPECTO DEL CUAL SE DEBE ACREDITAR ESTE
    REQUISITO»
- `type FilaCapacitacion = { actividad: string; horas: string; materia: string; puesto: string }`.
  La **actividad se hereda** del cuadro de Experiencia del personal clave (mismo
  personal), igual que en Formación académica: no se teclea, se copia por fila.
- `FILA_CAPACITACION_VACIA`.
- `componerRequisitoCapacitacion(f: Partial<FilaCapacitacion>): string`
  → `` `${hueco(horas, HUECO_HORAS)} horas en ${hueco(materia, HUECO_MATERIA)} del personal clave requerido como ${hueco(puesto, HUECO_PUESTO)}.` ``
- `parseFilasCapacitacion(texto)` / `formatFilasCapacitacion(filas)`: par reversible.
  Línea serializada: `N. Actividad: … · Horas: … · Materia: … · Puesto: …`.
- `capacitacionIncompletas(filas): number[]` — filas con algo escrito a las que
  falta horas, materia o puesto (la actividad viene heredada, no se exige aquí).
- `capacitacionExcedeHoras(filas): number[]` — filas cuyo `Number(horas) > 120`.
  Alimenta el **aviso suave** (no bloquea el guardado).
- `ACREDITACION_CAPACITACION`: literal fijo del formato OECE. **Entrada externa**
  (ver §7); hasta tenerlo, un marcador `[PENDIENTE: texto de acreditación de
  capacitación del formato OECE]`.

## 2. Datos y esquema

- **Columnas nuevas** en `necesidades`:
  - `capacitacion_personal_clave` (text) — cuadro serializado.
  - `capacitacion_personal_clave_acreditacion` (text) — texto de acreditación.
- **Catálogo** [lib/necesidad-ficha-secciones.ts](../../../lib/necesidad-ficha-secciones.ts):
  dos `FichaField` nuevos, ambos `oculto`, en la sección **3.5.1**, inmediatamente
  después de `formacion_academica_acreditacion`:
  - `{ col: "capacitacion_personal_clave", api: "capacitacionPersonalClave", kind: "capacitacion", oculto: true, baseLegal: "Art. 72.3.b Reglamento · …" }`
  - `{ col: "capacitacion_personal_clave_acreditacion", api: "capacitacionPersonalClaveAcreditacion", kind: "textarea", oculto: true, baseLegal: "Art. 72.3.b Reglamento · forma de acreditar la capacitación (Anexo N° 19)." }`
  - Nuevo valor `"capacitacion"` en la unión `FichaFieldKind`.
- Como `columnasSelect`/`construirColumnas` se **derivan** del catálogo, el GET y
  el PATCH recogen las columnas solas: no hay lista manual que tocar.
- `necesidadUpdateSchema` ([lib/necesidades.ts](../../../lib/necesidades.ts)):
  añadir `capacitacionPersonalClave` y `capacitacionPersonalClaveAcreditacion`
  (string, opcional).
- `LIMITES_TEXTO` ([lib/necesidades-limites.ts](../../../lib/necesidades-limites.ts)):
  tope de texto para ambos, como el de formación.
- **SQL manual** en `docs/supabase/`: fichero que añade las dos columnas a
  `necesidades`. Se entrega y se señala explícitamente al terminar: **no existen
  hasta que alguien corre el SQL**. (La tabla está particionada por año; el SQL
  debe alcanzar la partición correspondiente igual que hicieron las columnas de
  formación.)

## 3. Interfaz

- Nuevo componente `app/components/capacitacion-personal-clave-editor.tsx`, calco
  de [app/components/formacion-academica-editor.tsx](../../../app/components/formacion-academica-editor.tsx):
  cuadro con botón «Agregar»; por fila **Horas** (numérico, máx. 120 con aviso
  suave), **Materia**, **Puesto**; la **Actividad** heredada se muestra como
  encabezado de fila (no editable), tomada del cuadro de experiencia.
- Se renderiza **dentro de** [app/components/requisitos-calificacion-editor.tsx](../../../app/components/requisitos-calificacion-editor.tsx),
  **tras** el editor de Formación académica, dentro de la misma tarjeta de
  «Propuesta de requisitos de calificación».
- [app/components/necesidad/campo-ficha.tsx](../../../app/components/necesidad/campo-ficha.tsx):
  añadir el caso del `kind` `"capacitacion"` (el campo es `oculto`, así que en la
  práctica lo pinta el editor de requisitos, mismo camino que formación).

## 4. Documento Word

En [lib/requerimiento-estructura.ts](../../../lib/requerimiento-estructura.ts):
tras la tabla de Formación académica, una tabla de Capacitación del personal
clave (una fila por requisito, con su texto compuesto) seguida del bloque de
acreditación `ACREDITACION_CAPACITACION`. Mismo tratamiento de excepción que ya
usan experiencia y formación para campos `oculto` que sí van al documento.

## 5. Herencia de la actividad

Igual que Formación académica: al abrir la ficha, cada fila de capacitación
hereda la `actividad` de la fila correspondiente del cuadro de Experiencia del
personal clave. El diseño reutiliza el mismo mecanismo que ya conecta
experiencia → formación (se confirma su forma exacta al implementar, para
copiarlo, no reinventarlo).

## 6. Tests

`tests/necesidad-capacitacion-personal-clave.test.ts`, calco de los de formación:
- `parse`∘`format` es identidad sobre filas con contenido.
- `componerRequisitoCapacitacion` con todos los campos, y con huecos vacíos
  (aparecen los `[HUECO]` correctos y el conector « horas en » / « del personal
  clave requerido como »).
- `capacitacionIncompletas` detecta falta de horas/materia/puesto e ignora la
  actividad heredada.
- `capacitacionExcedeHoras` corta en 120 (120 no excede; 121 sí; no-numérico no
  cuenta).

## 7. Entrada externa pendiente

El **literal de acreditación** del formato OECE para capacitación lo pasa el
usuario después. Hasta entonces `ACREDITACION_CAPACITACION` lleva el marcador
`[PENDIENTE…]`. Es el único hueco; no afecta al resto de la implementación.

## No incluido (YAGNI)

- Sin validación dura de las 120 horas (solo aviso suave).
- Sin migración por fila de datos históricos: es un requisito nuevo, no había
  dónde guardarlo antes.
- Sin tocar 3.5.2 ni la lógica de secciones visibles más allá de los dos campos
  nuevos.
