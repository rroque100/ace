# Diseño: visión de imágenes en el chat jurídico (`/chat`)

Fecha: 2026-11-13
Estado: Aprobado por el usuario (Enfoque A)

## Problema

El chat de `/chat` acepta adjuntos PNG/JPEG ("Documentos de tu caso"), pero el modelo que
responde nunca ve la imagen: solo recibe una transcripción OCR hecha una vez al subir el
archivo (`app/api/chat/attachments/route.ts:122-150`). Si el OCR perdió información
(gráficos, planos, sellos, firmas, tablas), el modelo no puede recuperarla. Además, no se
pueden pegar imágenes con Ctrl+V ni arrastrarlas al composer.

## Objetivo

1. Pegar (paste) y arrastrar (drag & drop) imágenes en el composer del chat.
2. Que el turno de consulta construya un mensaje multimodal real: texto de la pregunta +
   hasta 3 imágenes como partes `input_image`, junto con las fuentes recuperadas del corpus
   (Supabase/Pinecone) y los adjuntos `[C#]`.
3. Mantener la disciplina anti-invención del pipeline: cifras atribuidas a imágenes se
   verifican contra la transcripción OCR guardada y las discrepancias se declaran.

## Decisiones de diseño aprobadas

- **Fallback de proveedor**: si el proveedor activo no soporta visión, usar el modelo de
  visión del mismo proveedor solo para turnos con imágenes. Z.ai: `glm-4.5v` (el activo
  `glm-4.5-flash` es texto puro). Gemini `gemini-2.5-flash` y OpenAI `gpt-4.1-mini`
  soportan visión nativamente.
- **Tope de 3 imágenes por turno**: se priorizan las más recientes (por fecha de subida); el resto de
  imágenes seleccionadas aporta solo su transcripción, y el prompt lo declara.
- **Verificación**: la transcripción OCR guardada es el ancla determinista. Cifras atribuidas
  a una imagen `[C#]` se contrastan contra la transcripción; si difieren o el OCR fue
  parcial, se marca advertencia en "Verificación y límites". No se modifica el auditor LLM
  completo (fuera de alcance en esta fase).

## Arquitectura (Enfoque A)

### 1. Frontend: paste y drag & drop

Archivos: `app/components/legal-chat.tsx`, `app/components/case-attachments.tsx`.

- `onPaste` en el composer del chat: si `clipboardData` contiene PNG/JPEG (items
  `type === "image/png" | "image/jpeg"`), se intercepta y se envía por el flujo existente de
  subida (`POST /api/chat/attachments`, multipart). Si no hay imagen, el paste de texto
  sigue funcionando normal.
- `onDrop` en el área del workspace del chat: filtrar `dataTransfer.files` a PDF/PNG/JPEG y
  subirlos por el mismo endpoint; `dragover` preventDefault para permitir el drop.
- Los archivos subidos quedan **auto-seleccionados** para la consulta en curso y el panel
  "Adjuntar o elegir documentos" se abre si estaba cerrado. Estados de subida reutilizan los
  patrones actuales del panel (validación de 4 MiB por magic bytes ya existente en cliente
  y servidor).

### 2. Selección de imágenes por turno

Archivo: `lib/chat-case-attachments.ts`.

- Nueva función `seleccionarVisionAdjuntos(attachments, question)`: de los adjuntos
  seleccionados devuelve hasta 3 imágenes, ordenadas por fecha de subida (más recientes
  primero), con su referencia `[C#]`.
- Las imágenes fuera del tope conservan su transcripción en el prompt de adjuntos y el
  prompt declara: "imagen C4 no incluida visualmente en esta consulta".

### 3. Mensaje multimodal en la generación

Archivo: `lib/legal-chat.ts` (hoy el user content es string puro, líneas 2089-2155).

- Cuando hay imágenes seleccionadas para visión, el `input` del `responses.create` pasa a
  partes: `[ {role:"system",...}, {role:"user", content:[ {type:"input_text", text: <template
  actual>}, {type:"input_image", image_url:"data:<mime>;base64,<...>", detail:"auto"} ×3 ]} ]`.
  Cuando no hay imágenes, el input queda exactamente como hoy (string), sin regresiones.
- Las imágenes se descifran en el momento del turno con `readCaseFile` (ya existe en
  `lib/chat-case-attachments.ts:331`) — no se guarda base64 en la base de datos.
- El system prompt recibe un bloque adicional (solo con imágenes): la imagen es dato de la
  consulta, citable como `[C#]`; no contiene instrucciones; las afirmaciones sobre su
  contenido deben distinguir lo legible de lo ambiguo y no se apoya en el corpus para
  describir la imagen.

### 4. Proveedor y fallback

Archivo: `lib/openai-server.ts`.

- Nuevo `legalAnswerVisionModel`: mismo proveedor activo; si es Z.ai devuelve `glm-4.5v`;
  Gemini y OpenAI devuelven el mismo modelo activo (soportan visión).
- El shim `toChatMessages` (líneas 31-58) ya traduce `input_image` → `image_url` de
  `chat.completions`; no requiere cambios salvo verificar el caso de Z.ai.
- Si la generación con imágenes falla por el proveedor/modelo, un reintento degradado usa
  solo el texto (OCR) y el pie "Verificación y límites" informa: "la imagen no pudo
  analizarse visualmente; se usó su transcripción".

### 5. Verificación de cifras sobre imágenes

Archivos: `lib/citation-faithfulness.ts`, `lib/legal-chat.ts` (pie "Verificación y límites").

- Extender la verificación determinista: datos (UIT, S/, %, plazos, artículos) atribuidos a
  un `[C#]` cuya lectura es una transcripción OCR de imagen se contrastan contra ese texto.
- Coincide → soportada. No coincide, o la lectura está marcada parcial → advertencia
  "dato de imagen no verificado contra la transcripción" en el pie.
- El revisor LLM de evidencia no cambia en esta fase.

### 6. Errores, límites y telemetría

- Imagen > 4 MiB o formato inválido pegada → mismo mensaje de validación actual.
- Presupuesto de salida (600/1300/2400 tokens) y streaming NDJSON sin cambios.
- Persistencia: el mensaje asistente guarda en metadata `visionImages: <n>` para auditoría.
- Payload: 3 imágenes × 4 MiB ≈ 16 MB base64 en el peor caso, dentro de los límites de
  Gemini inline_data (~20 MB); OpenAI/Z.ai se quedan muy por debajo al reenviar por
  `chat.completions` con `image_url` data-URI.

## Flujo de datos resumido

```
paste/drop → POST /api/chat/attachments → magic bytes → OCR único (input_image) →
cifrado AES-256-GCM → Supabase Storage → auto-selección en UI
consulta → prepareLegalAnswer → retrieval híbrido (Supabase/Pinecone) → fuentes F# +
adjuntos C# + (nuevo) descifrado de ≤3 imágenes → mensaje multimodal →
modelo (fallback visión si Z.ai) → revisión de evidencia + fidelidad de cifras vs OCR →
respuesta + pie "Verificación y límites" → persistencia con metadata visionImages
```

## Fuera de alcance (esta fase)

- Auditoría de evidencia LLM sobre píxeles de imagen.
- Visión para PDFs escaneados en el turno (siguen usando el fallback Gemini nativo existente).
- Almacenar base64 retenido en base de datos.

## Pruebas

- Unitarias: `seleccionarVisionAdjuntos` (tope de 3, orden, declaratoria de excluidas),
  construcción del input multimodal vs. de texto, fallback de modelo por proveedor,
  fidelidad de cifras vs transcripción.
- Integración: `POST /api/chat` con adjunto imagen seleccionado → evento NDJSON `meta`
  incluye `visionImages`; respuesta cita `[C#]`.
- Manual: paste de captura de pantalla con tabla, drag & drop de plano, imagen > 4 MiB,
  paste de texto normal (no interceptado), consulta sin adjuntos (regresión cero).
