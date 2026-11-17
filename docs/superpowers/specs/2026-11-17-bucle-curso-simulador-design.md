# Mejoras al bucle de estudio del curso — Diseño

**Fecha:** 2026-11-17 · **Estado:** aprobado por el usuario · **Curso:** `/cursos/certificacion-oece`

Tres mejoras independientes, nacidas del análisis de coherencia y del estado real del código en producción.

## 1. Bucle simulador→curso («Estudiar la clase»)

**Problema.** El coaching del banco (`ExamCoachingPanel`) detecta el tema débil y solo ofrece «Preparar mi práctica»; nunca remite a la clase del curso que enseña ese tema. El bucle curso→simulador existe (puntos de control con `?seccion=banco`); el inverso no.

**Diseño.**
- `lib/exam-coaching.ts`: la recomendación del tema débil pasa a agruparse por **código de subcompetencia** y a llevar ese código además de la etiqueta (`recommendation.code`). Empate determinista por código. Quien no tenga clasificación vigente no cambia de comportamiento.
- `lib/cursos/temario-examen.ts` (puro): nueva `clasesDeTema(clases, code)` — las clases que declaran ese tema en `temas`, ordenadas por peso de cuota descendente y luego por orden del curso (mismo criterio que `resultadoDiagnostico`). Tema sin clase → lista vacía.
- `ExamCoachingPanel` (exam-training.tsx): prop opcional `claseSugerida?: { slug: string; titulo: string }` que se pinta como enlace secundario «Estudiar la clase «Título»» hacia `/cursos/certificacion-oece/{slug}`. El panel sigue sin conocer el catálogo: quien resuelve tema→clase es `exam-workspace.tsx` con `clasesDeTema`.
- Acceso: toda cuenta que ve el banco tiene el módulo «simulacro», que ya incluye `/cursos` (`lib/modulos-acceso.ts`), así que el enlace nunca acaba en rechazo.

**Tests.** `exam-coaching` actualizado (la recomendación lleva código); test puro de `clasesDeTema` (2.8 → clases de apelación; tema inexistente → vacío; complementos con `temas: []` nunca casan).

## 2. Etiquetar las 144 preguntas de los balotarios 1–2

**Problema.** Los balotarios 1 y 2 no tienen `competencia` en `balotarios-oece.json` (hallazgo 4.3 del análisis de coherencia): los resultados de esos balotarios no muestran desglose por competencia.

**Diseño.**
- Script desechable que asigna `competencia` a las 144 preguntas: parsea las tablas de `docs/evaluaciones/2026-11-17-anexos-coherencia/analisis-b{1,2}.md`; cada fila cubierta toma la competencia de la sección del curso que contiene su clase; cada fila `NO_CUBIERTA` se clasifica con las reglas de palabras clave ya documentadas en `docs/superpowers/plans/2026-11-17-curso-examen-coherencia.md` (obra→C3, apelación/buena pro/bases→C2, requerimiento/PAC/estrategia→C1, contrato/garantía/modificación→C3).
- Solo se escriben los campos `competencia` de B1/B2; el resto del JSON debe quedar byte a byte (verificación de ida y vuelta: `JSON.parse` → `JSON.stringify(obj, null, 2)` reproduce el archivo actual antes de mutar; si no reproduce, se aborta).
- Las 6 preguntas ya corregidas alinean su etiqueta con la del overlay de `balotario_reviews` (que manda en runtime).
- Resultado esperado: `diagnosticoBalotarios()` informa 0/360 sin competencia.

**Tests.** Regresión en `balotarios-catalogo`: ninguna pregunta del catálogo queda sin competencia.

## 3. Seis casuísticas nuevas en los temas más pesados (108 → 114)

Por cuota del examen y casos ya existentes (1.2 ya tiene 13 casos; no se toca):

| Clase (tema, cuota) | Hoy | Añade | Casos (regla, ya verificada verbatim contra el corpus) |
|---|---|---|---|
| `expediente-contratacion` (1.1, 6/72) | 3 | +2 | documentos mínimos para aprobar (Rgto. 54) · desierto no exige reaprobar (Rgto. 63) |
| `plazos-buena-pro-seleccion` (2.2, 8/72) | 3 | +2 | prórroga de etapas se registra en Pladicop (Rgto. 64.2) · ofertas ≥7 d/h desde integración, abreviadas ≥3 (Rgto. 68.1) |
| `modificaciones-procedimiento` (3.2, 6/72) | 3 | +1 | cesión de posición contractual entre entidades (Rgto. 112.2) |
| `suspension-reprogramacion-obra` (3.10, 5/72) | 3 | +1 | programa acelerado 7/5/7; sin observación se aprueba (Rgto. 207.2) |

Cada caso: enunciado situacional, resolución con la regla aplicada y base legal. Solo reglas con chunk leído (disciplina del skill `verificacion-legal-rag`); nada nuevo que no se haya verificado.

## Fuera de alcance

- Vídeos reales (decisión de contenido: autorización de CAEM o producción propia).
- Reequilibrar B3–B5 hacia el reparto 25/22/25 (el simulacro del banco ya sigue el reparto oficial).
- Cambiar el mecanismo de revisiones (`balotario_reviews` sigue siendo la única vía para corregir preguntas).
