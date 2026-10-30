# Respaldo de generación Gemini → OpenCode

- Gemini directo conserva la prioridad. Con `OPENCODE_API_KEY` y `OPENCODE_FALLBACK_ENABLED=true`, un HTTP 402 (crédito) o 429 (cuota del proveedor) activa OpenCode. No se usa para ocultar errores de autenticación, validación, cancelación o cuota mensual del usuario de ACE.
- Modelo de respaldo: `OPENCODE_MODEL`, por defecto `gemini-3.8-flash`. Endpoints oficiales OpenCode Inference, compatibles con chat/completions y Google generateContent. La clave es exclusivamente del servidor, nunca `NEXT_PUBLIC_*`.
- Chat, preparación de búsqueda, clasificación y análisis de texto comparten el cliente. OCR/PDF y voz usan el protocolo multimodal de Google a través del gateway. El consentimiento de voz identifica `gemini-opencode`, distinto del consentimiento anterior que solo indicaba Google. La ampliación a audio y PDF fue autorizada expresamente por el administrador el 30/10/2026.
- Pausa del primario por instancia: cinco minutos para falta de crédito y un minuto para 429; después se vuelve a probar Gemini. No es un interruptor persistente global entre todas las instancias de Vercel.
- No se cambia de proveedor después de emitir eventos de una respuesta. Si ambos fallan, el error se propaga a las salvaguardas existentes; no hay bucle entre proveedores. Las comprobaciones de fuentes jurídicas permanecen.
- El uso se atribuye al proveedor y modelo efectivos. La tarifa añadida para Gemini 3.8 Flash es una estimación de lista (USD 1.50/7.50 por millón de tokens de entrada/salida), no incluye cargos de compra de créditos.
- **Embeddings excluidos:** el índice existente está asociado a su modelo y espacio vectorial. OpenCode no se utiliza como reemplazo de embeddings de Google. Ante crédito agotado, la búsqueda conserva su recuperación léxica existente y la cola de indexación permanece pendiente; no se reanuda una importación masiva desde esta integración.
- Desactivar: `OPENCODE_FALLBACK_ENABLED=false` y desplegar nuevamente. No modificar modelos de embeddings sin namespace y reindexación compatibles.

Verificación: pruebas de política (crédito, cuota, pausa, recuperación, cancelación y streaming), SDK real con transporte simulado, consentimiento de voz y conservación de contenido multimodal. Prueba real optativa con `ACE_TEST_OPENCODE_LIVE=1` y `OPENCODE_API_KEY` en entorno: `npx vitest run tests/opencode-live.test.ts`. Emplea texto/PDF públicos sintéticos y silencio WAV; no acredita precisión jurídica ni reconocimiento de voz real.

Documentación contrastada: https://opencode.ai/v2/docs/console/models/ (30/10/2026). La disponibilidad del modelo se comprobó además contra el catálogo y los endpoints reales.

## Tercer proveedor: Z.ai (30/10/2026)

- Para generación de texto: Gemini directo → OpenCode → Z.ai, con `ZAI_API_KEY`, `ZAI_FALLBACK_ENABLED=true` y `ZAI_MODEL=glm-4.5-flash`. Clave exclusiva del servidor; endpoint estándar `https://api.z.ai/api/paas/v4`.
- Z.ai se activa ante el mismo agotamiento de crédito/cuota (402/429 o precondición de facturación reconocida). Si OpenCode no está configurado, puede respaldar directamente a Gemini. Los errores de autenticación/formato y la cuota del usuario no se ocultan.
- Cada predecesor tiene su pausa y recuperación por instancia. No se concatenan respuestas de distintos proveedores; el tercer fallo se propaga sin bucles. El proveedor y modelo reales se registran en consumo y detalles del Chat.
- El tercer modelo acepta solo entradas textuales. No se mandan automáticamente imágenes, audio ni archivos/PDF originales a Z.ai; el protocolo multimodal mantiene Gemini/OpenCode y los embeddings no cambian. El texto extraído puede analizarse con Z.ai.
- La búsqueda por voz informa por separado del destino de la grabación y del orden de proveedores para analizar el texto revisado.
- Verificado GLM-4.5-Flash con respuestas reales de texto/JSON y streaming; dos fallos 402 de sus predecesores se simularon sin alterar los proveedores de producción. Prueba optativa: `ACE_TEST_ZAI_LIVE=1` y `ZAI_API_KEY` en entorno, `npx vitest run tests/zai-live.test.ts`.
- Referencia oficial: https://docs.z.ai/api-reference/llm/chat-completion. No se infiere precisión jurídica por la disponibilidad de un modelo.
