# Preparación OECE — entrega funcional y pendientes editoriales

Fecha local: 29 de octubre de 2026, Lima.

## Implementado

- Temario versionado con 30 subcompetencias. Perfil fijo de 72 preguntas y 120 minutos, distribución 25/22/25 y cuotas individuales comprobadas en servidor.
- Cobertura visible: no inicia el perfil si falta una cuota de preguntas publicadas y elegibles.
- Banco con competencia, subcompetencia, demanda cognitiva, dificultad editorial, fecha de corte, fuente y explicación individual de las cuatro alternativas.
- Publicación exige comprobaciones editoriales, fundamento y confirmación explícita. Un borrador generado no se marca como revisión humana.
- Cinco balotarios por edición, sin repetidos entre conjuntos y con revisión de cada pregunta fijada. Se requiere cobertura editorial de 360 preguntas antes de ensamblarlos.
- Repaso de errores propios con revisión actual, exclusión de vistas de borradores y progreso por competencia.
- Reportes y resolución trazable. Métricas por revisión, primeras exposiciones comparables, alternativas y tiempo observado. Muestras pequeñas identificadas; sin garantía de aprobación.
- Verificación de fuente institucional indexada, huella del PDF, título, versión y régimen. Cambiar la versión invalida su elegibilidad hasta nueva revisión.

## Banco real

Verificación final: 215 borradores clasificados de la meta de 360; 0 publicados. Hay 242 registros en total, incluyendo borradores anteriores y clasificación pendiente. Se comprobaron 220 asociaciones de cita con documento, fragmento y páginas para los borradores clasificados.

Dificultad propuesta: 97 básicos, 111 intermedios y 7 avanzados. Demanda propuesta: 84 de comprensión, 119 de aplicación y 12 de análisis. Son etiquetas editoriales pendientes de revisión y calibración, no dificultad estadística demostrada.

La última ampliación automática se detuvo por un límite del proveedor de IA. Faltan 145 borradores para la meta cuantitativa; además, todos requieren revisión jurídica humana de clasificación, clave, distractores, explicación y fuente. No se copiaron preguntas de LEX.

## Verificación

- 28 pruebas automatizadas correctas en cinco archivos del simulador.
- TypeScript completo sin errores y lint de las fuentes del módulo sin errores.
- Migraciones 202610290002 a 202610290008 aplicadas.
- Pruebas SQL transaccionales correctas, con rollback: cuotas, perfil fijo, 360 fixtures en cinco conjuntos, revisión fijada, aislamiento, tiempo observado, reportes, repaso y cambio de versión de fuente. Los fixtures no permanecen publicados.
- Interfaz de cobertura, banco editorial, explicaciones de alternativas, PDF y acceso a Normativa comprobados en navegador. Vista de 390 × 844 sin desbordamiento horizontal; no sustituye una prueba con teléfono físico.
- APIs sin sesión rechazan el acceso. Las estadísticas editoriales no se incluyen en la respuesta para usuarios ordinarios.

## Publicación

Despliegue comprobado: `dpl_yvGsnvdiMPuZRA5FHcCr27wtYB7c`, alias https://ace-rormi.vercel.app/simulador.

Un despliegue paralelo desde main sustituyó temporalmente el alias y devolvió 404 en el simulador. Se promovió nuevamente el despliegue comprobado. Los cambios actuales de estas entregas todavía requieren commit y push en la rama de trabajo antes de integrarse en main; desplegar una versión anterior puede volver a retirar estas rutas.

El entrenamiento completo y los cinco balotarios siguen bloqueados hasta contar con preguntas suficientes publicadas mediante revisión humana. La vista de borradores es exclusiva de administración.
