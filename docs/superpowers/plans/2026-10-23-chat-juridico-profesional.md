# Chat jurídico profesional — Implementation Plan

**Goal:** Implementar el diseño aprobado de trazabilidad, control de publicación y evaluación del chat.
**Architecture:** Auditoría aislada por afirmaciones; finalizador compartido por chat normal y transmisión; contrato de calidad persistido en assessment. Interfaz compatible con historial anterior.
**Tech Stack:** Next.js, TypeScript, Zod, proveedor Responses existente, Vitest.

## Restricciones
No inferir vigencia por fechas, no inventar reglas legales ni revisión humana. Preservar RLS y cambios ajenos. Sin proveedores nuevos.

### 1. Contexto y ubicaciones
- [x] Ampliar caseContextSchema con objeto opcional compatible y añadir campo visible.
- [x] Ampliar chatSourceLocations con artículo, numeral y versión registrados, sin confundir referencias indirectas.
- [x] Probar ausencia de metadatos y compatibilidad.

### 2. Auditoría y publicación
- [x] Crear lib/chat-evidence-audit.ts: segmentar respuesta por afirmaciones; comprobar cada cita; pedir JSON al proveedor con veredicto y pasaje literal; validar cobertura completa y pasajes existentes; límite 24 afirmaciones y 25 segundos, sin reintentos.
- [x] Fallar de forma cerrada ante cifras mal atribuidas, negación, citas inexistentes, JSON inválido, pasajes falsos o fallo del proveedor.
- [x] Unificar finalización, estados y persistencia en lib/legal-chat.ts; buffer de transmisión hasta finalizar auditoría.
- [x] Probar normal/transmisión, fallos y ausencia de fuga de borrador.

### 3. Interfaz
- [x] Mostrar progreso accesible, respaldo documental y aplicabilidad pendiente; conversaciones antiguas no reevaluadas.
- [x] Quitar confianza alta anterior del texto generado; enriquecer las fuentes con ubicaciones reales.

### 4. Evaluación y aceptación
- [x] Crear banco sintético sin reglas normativas reales inventadas y plantilla de revisión humana pendiente.
- [x] Probar caso adversarial de mismo porcentaje para otro concepto, negación y fuente de régimen distinto.
- [x] Ejecutar pruebas focalizadas, tipos, lint y compilación. Registrar resultados y límites, sin afirmar despliegue no verificado.


## Ejecución
Se implementaron módulos de auditoría, selección coherente por identidad documental (sin determinar aplicabilidad), citas con versión explícita, objeto del caso, progreso accesible y estados finales compartidos por respuesta normal y transmisión. Se corrigió el control numérico para comprobar unidad/valor y marcadores anotados. El banco de revisión humana permanece pendiente de un especialista.

Validación: pruebas focalizadas, tipos y lint satisfactorios; compilación de producción final satisfactoria. Se ejecutó una evaluación real con Gemini 2.5 Flash: el primer ensayo falló en objeto distinto; se añadió un control conservador y el segundo ensayo completó 7/7 controles sintéticos. La prueba integral de la pregunta original, sin historial ni escrituras, recuperó el artículo de reglamento y superó el control de afirmaciones. No demuestra precisión jurídica general.

La prueba completa con concurrencia por defecto tuvo 109 fallos por tiempo de espera en 13 archivos de módulos no modificados (3013 pruebas aprobadas). Una muestra aislada de esos fallos aprobó con un solo trabajador (6/6). Se inició una repetición con dos trabajadores para comprobar el efecto de recursos. No se cambian esos módulos.

Publicación: estos cambios están en el proyecto local. No se afirma despliegue en Vercel ni revisión jurídica humana.

Cierre: 3.128 pruebas globales aprobadas con concurrencia controlada; 59 pruebas focalizadas finales aprobadas. Tipos, lint y compilación final satisfactorios. Informe en docs/evaluaciones/chat-juridico/validacion-2026-10-23.md.
