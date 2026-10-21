# Estructura de la ficha de necesidad: dos modos de trabajo

**Fecha:** 26 de julio de 2026
**Ámbito:** `/necesidades/[id]` — la ficha del requerimiento
**Estado:** diseño aprobado, pendiente de plan de implementación

---

## El problema

La pantalla apila doce bloques: flujo, diff de no objeción, verificación DEC, coherencia,
admisibilidad, observaciones, historial, ficha, derivación, adjuntos, EETT/TDR y riesgos. La
ficha sola son doce apartados y el 59 % de la página.

Cuatro molestias, confirmadas por quien la usa: demasiado desplazamiento, no saber qué falta
ni dónde, ruido de bloques que no tocan en ese momento, y lentitud.

### Cómo se usa de verdad

Datos de la base, no suposiciones:

- **La ficha no se rellena de una sentada.** 10 de 11 necesidades se editaron en un día
  distinto al de creación, con 71 horas de media entre creación y última edición.
- **Se vuelve a ella para seguir redactando**, no para consultar de pasada.
- **Se trabaja en «Formulario completo».** El modo «Paso a paso» existe y es el que viene por
  defecto, pero se cambia casi siempre — así que hoy el asistente es fricción en cada apertura,
  y encima la elección no se recuerda.
- Once usuarios en cinco roles: 5 oficial de compra, 2 área usuaria, 2 DEC, 1 consulta, 1 admin.

## La decisión

Un interruptor con dos modos: **Redactar** y **Revisar**.

Se descartaron dos alternativas:

- **Tres pestañas por fase** (Requerimiento / Revisión / Cierre): más orden y mejor
  rendimiento, pero convierte un sitio en tres y es la que más memoria muscular rompe. Y el
  asistente ya demostró que obligar a navegar entre pasos se rechaza.
- **Seguir en una página, mejor navegada** (paneles plegados, estado recordado): la más barata,
  pero pliega el ruido en vez de quitarlo y deja la página igual de larga. Media solución a dos
  de las cuatro molestias.

Dos modos separan **el trabajo** del **juicio sobre el trabajo**, que es la división que ya
existe en la organización: el área usuaria redacta, la DEC revisa. Y añade un solo concepto
nuevo, del tipo que el usuario ya maneja.

## Qué va en cada modo

### Redactar

| Bloque | Sitio |
| --- | --- |
| Cabecera: nombre, estado, veredicto «lista para remitir», avance | arriba |
| Flujo (stepper), con el diff de no objeción cuando lo hay | arriba |
| EETT / TDR | antes de la ficha: es su insumo |
| Ficha del requerimiento (editable) | columna principal |
| ¿Está lista? · Coherencia · Observaciones · Adjuntos | columna lateral fija |
| Matriz de riesgos | tras la ficha (Art. 44.3: el riesgo se identifica al elaborar el requerimiento) |

### Revisar

| Bloque | Sitio |
| --- | --- |
| Cabecera y flujo, con el diff de no objeción | arriba, iguales |
| Verificación y coherencia | centro, en grande |
| Admisibilidad (DEC) | centro |
| Observaciones, con alta | centro |
| Ficha del requerimiento (solo lectura) | centro |
| Derivación a expediente | cierre |
| Historial | cierre, plegado |

Tres reglas de reparto:

1. **La ficha aparece en los dos modos**, editable en uno y de lectura en el otro. Quien revisa
   necesita leer lo que juzga sin cambiar de modo. Lo mismo la cabecera y el flujo, que dan la
   orientación en ambos: el diff de no objeción viaja con el flujo, porque explica el punto en
   que está.

2. **Los diagnósticos cambian de sitio, no de contenido.** En Redactar van compactos al lateral
   diciendo qué falta; en Revisar ocupan el centro, porque ahí son el trabajo.
3. **Nada desaparece.** Los doce bloques siguen existiendo, repartidos. Es una separación, no
   una poda.

## Comportamiento

### Arranque y memoria

Arranca en **Redactar** y recuerda el último modo usado, por usuario, en el navegador — el
mismo mecanismo que ya usa «Modo simple».

Esto reparte por rol **sin una tabla de roles**: quien trabaja en la DEC acabará abriendo en
Revisar porque es donde trabaja. La personalización sale del uso. Y mantiene lo ya decidido en
la propuesta de reordenación de paneles: una sola estructura para todos, no dos pantallas.

### Saltos automáticos entre modos

Es el riesgo principal del diseño y por eso va explícito. Cuando una acción apunta a un bloque
del otro modo, se cambia de modo antes de actuar:

| Acción | Efecto |
| --- | --- |
| «Ir al campo» desde un diagnóstico en Revisar | cambia a Redactar, abre la ficha en edición y enfoca el campo |
| Chip de navegación rápida hacia un bloque del otro modo | cambia de modo y luego se desplaza |
| Entrar a editar la ficha | fuerza Redactar (en Revisar es de solo lectura) |

Sin esto, el clic no haría nada y nadie sabría por qué. Es el fallo que ya apareció dos veces
en esta pantalla: un índice que apuntaba a un campo oculto por el filtro, y un foco que saltaba
a un elemento no montado.

### Rendimiento

El modo inactivo no se monta, así que Revisar deja de renderizar mientras se redacta.

**No es la solución a la lentitud.** La ficha es el 59 % de la página y sigue montada; la causa
está en un único `fichaForm` en la raíz de un componente de 4 822 líneas con 74 estados, que
hace re-renderizar todo con cada tecla. Ese trabajo tiene su propio diseño.

## Construcción

### El conocimiento del modo sale del componente

Módulo nuevo `lib/necesidad-modos.ts`, con funciones puras:

- `panelesDelModo(modo)` — qué bloques pertenecen a cada modo
- `modoParaSeccion(idSeccion)` — en qué modo vive un `sec-*`, que es lo que necesitan los saltos

El motivo es de comprobabilidad: **el suite no renderiza React** (`environment: "node"`, solo
`.test.ts`). Con el reparto dentro del JSX no se puede probar nada; en funciones puras se
prueba lo que puede fallar de verdad.

En el componente, dos funciones de render —`renderModoRedactar()` y `renderModoRevisar()`—
junto a las que ya existen.

### Por qué NO se extrae a ficheros ahora

Lo natural sería un fichero por modo, y las 4 822 líneas lo piden. El obstáculo no es el modo:
son los 74 estados en la raíz. Extraer hoy obliga a pasar treinta props o montar un contexto
solo para esquivar el problema real.

El corte por modos **crea la costura**. La extracción va después del reparto de estado, que es
el mismo trabajo que arregla la lentitud. Al revés se paga dos veces.

### Fallos

- Sin acceso al almacenamiento del navegador: arranca en Redactar, no rompe.
- `sec-*` sin modo declarado: no cambia de modo y se desplaza si puede. Degrada, no revienta —
  y la condición la detecta el test, no el usuario.

## Pruebas

Sobre `lib/necesidad-modos.ts`, en el suite existente:

1. Ningún bloque queda huérfano: todos los `sec-*` de la pantalla tienen modo.
2. Ninguno está duplicado, salvo los declarados a propósito en ambos (cabecera, flujo, ficha).
3. Cada chip de navegación rápida apunta a un `sec-*` con modo conocido.
4. `modoParaSeccion` devuelve algo utilizable para un id desconocido, en vez de lanzar.

## Fuera de alcance

- **El modo en la URL.** Haría el enlace compartible («mira la revisión de esta necesidad»).
  Nadie lo ha pedido. Queda anotado.
- **El reparto del estado y la extracción a ficheros.** Es el trabajo que arregla la lentitud y
  merece su propio diseño.
- **El modo «Paso a paso».** Se conserva como está. Que su uso caiga a cero con este cambio es
  una señal a observar, no algo a decidir ahora.

## Riesgos

**Memoria muscular.** Quien use esto a diario sabe dónde está cada cosa. Cualquier
reorganización cuesta antes de rendir, y aquí además algunos bloques dejan de verse hasta
cambiar de modo. Merece avisar antes de que lo vean.

**Un modo mal repartido es peor que ninguno.** Si un bloque queda en el modo equivocado, el
usuario no lo encuentra y concluye que desapareció. De ahí que el reparto viva en un módulo
con pruebas y no disperso en el JSX.
