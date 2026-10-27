# Chat profesional: continuidad, calidad y trabajo

Diseño aprobado por el usuario: implementar las siete prioridades propuestas. Se conservan el sistema visual y las comprobaciones jurídicas existentes. No declarar revisión humana inexistente ni convertir valoraciones en precisión jurídica.

- [x] Continuidad: URL estable al guardar, borradores y lectura por usuario/conversación, recuperación tras recarga y aviso de almacenamiento no disponible.
- [x] Lectura: compositor compacto durante consulta; expansión por foco/borrador, controles accesibles y espacio reservado medido.
- [x] Conversación útil: aclaración del dato faltante pertinente y sugerencias derivadas de pregunta, evidencia, selección y límites.
- [x] Valoración: motivos definidos, comentario opcional, validación y trazabilidad; diferenciar opinión de usuario de revisión especializada.
- [x] Trabajo: vista previa de nota con pregunta, respuesta y fuentes; destino autorizado (necesidad, expediente, contrato); nota personal pendiente de revisión, accesible desde el destino.
- [x] Calidad: conjunto candidato con expectativas y citas verificables, registro de revisión especializada y ejecución separada de indicadores automáticos; sin etiquetar candidatos como aprobados.
- [x] Pruebas de recuperación, aislamiento, permisos, notas, evidencias y errores; tipos, lint, build y comprobación de producción.

Privacidad: borradores temporales en la sesión del navegador, sin trasladarlos a otros usuarios; fuente y destinos comprobados en el servidor. Las notas no modifican decisiones, estados ni documentos oficiales. No añadir accesos de servicio a información privada sin control de propietario/RLS.

## Validación

- 103 pruebas de comportamiento correctas; tipos, lint de cambios y compilación correctos.
- Supabase: ocho candidatos pendientes, cero casos etiquetados como revisados; políticas RLS activadas y acceso sin perfil rechazado en transacción revertida.
- Producción: recarga conserva sesión, borrador y desplazamiento (2102 px); compositor vacío de 74 px frente a 184 px expandido.
- Revisión jurídica especializada de los candidatos y pruebas con teclado virtual/dispositivos físicos pendientes. La evaluación es un flujo de referencias y valoración humana con indicadores documentales; no declara porcentaje general de precisión jurídica.

- Producción: nueva respuesta actualiza automáticamente la URL a su sesión, sin perder los mensajes; vista previa de nota y motivos de valoración comprobados. Inserción de nota con RLS confirmada dentro de una transacción revertida. Las sugerencias de artículos utilizan fuentes efectivamente citadas.
