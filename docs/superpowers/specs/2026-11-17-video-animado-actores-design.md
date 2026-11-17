# Video animado de «Actores involucrados» — Diseño

**Fecha:** 2026-11-17 · **Estado:** aprobado · **Piloto en:** `/cursos/certificacion-oece/actores-involucrados`

**Formato:** lección animada nativa de la clase — reemplaza la maqueta del reproductor. Escenas con fichas (icono + nombre + rol), narración con la voz del navegador (`speechSynthesis`, español, sin dependencias), subtítulos siempre visibles, avance automático al terminar cada audio y modo temporizado si no hay voz.

**Gancho visual:** la Ley llama «actores» a los participantes (Art. 9). El video presenta el **reparto de una contratación pública** como se presenta el elenco de una obra: cada escena entra con sus fichas y el narrador las presenta.

**Regla de contenido:** el guion solo dice lo que la clase ya enseña (verificada contra el corpus). Ninguna cifra nueva; las cintas citan artículos que constan en la clase o ya verificados verbatim esta sesión (Art. 302.1 del Reglamento, indelegabilidad de la AGA en apelaciones).

## Guion — 7 escenas (~2:30 narradas)

1. **Cinco actores en escena** (Ley 32069 · Art. 9) — DGA del MEF, OECE, Perú Compras, entidades contratantes y proveedores.
2. **Y dentro de la entidad, seis más** (Reglamento · Arts. 14–20) — titular, autoridad de la gestión administrativa (secretaría general o gerencia, según la entidad), área usuaria, área técnica estratégica, DEC y compradores públicos certificados.
3. **La DEC registra, no recibe** (Reglamento · Art. 14) — Pladicop con la excepción de comités y jurados, estrategia e interacción con el mercado; en el requerimiento solo lo normativo, lo técnico es del área usuaria.
4. **El área usuaria pide y conforma** (Reglamento · Art. 20) — requerimiento en coordinación con la DEC, verificación y conformidad.
5. **Quién aprueba qué** (Reglamento · Arts. 18 y 19) — titular: emergencia, desabastecimiento, adicionales de obra y anulación de laudo; AGA: los demás no competitivos, adicionales de bienes/servicios/consultorías y nulidades.
6. **Delegar: sí, pero no todo** (Ley 32069 · Art. 25 · Reglamento · Art. 302.1) — delegación por resolución; las apelaciones de la AGA, indelegables.
7. **Para el examen** — repaso del reparto con los cuatro protagonistas.

## Piezas

| Pieza | Responsabilidad |
|---|---|
| `lib/cursos/tipos.ts` | `Clase.animacion?: string` — une la clase con su guion. |
| `lib/cursos/videos.ts` | Guiones como datos: `EscenaVideo`, `FichaVideo`, `ICONOS_VIDEO`, `VIDEO_ESCENAS`. Módulo puro. |
| `app/components/cursos/video-animado.tsx` | Reproductor genérico: escenario `aspect-video`, fichas con entrada escalonada (transiciones Tailwind, `motion-reduce`), subtítulo/transcripción, voz, controles y progreso por escenas. |
| `lib/cursos/contenido/actos-preparatorios.ts` | La clase declara `animacion: "actores-involucrados"`. |
| `app/cursos/[curso]/[clase]/page.tsx` | Monta `VideoAnimado` cuando la clase tiene guion; si no, la maqueta. |
| `tests/cursos-videos.test.ts` | La clase declara su guion; 7 escenas completas; iconos dentro de los permitidos; el mapa de iconos del reproductor coincide con `ICONOS_VIDEO`. |

## Comportamiento del reproductor

- **Voz:** `speechSynthesis` con preferencia `es-PE` → latinoamericano → cualquier `es`. Al terminar el audio de una escena avanza solo; sin voz disponible, cada escena dura 9 s.
- **Pausar** cancela la narración y reanudar relanza la escena en curso desde el principio (granularidad de escena, robusta en todos los navegadores).
- **Sin cambios de BD ni migraciones:** todo es código versionado. Otra clase que quiera video solo necesita su guion en `VIDEO_ESCENAS` y su campo `animacion`.
