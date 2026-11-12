#!/usr/bin/env bash
# Regenera la migración global a Tailwind desde el `main` remoto, con las herramientas de esta rama.
#
#   bash scripts/tailwind-global/rehacer.sh [rama-base]      (por defecto rroque100/main)
#
# Borra app/ y la reconstruye: no lo lances con cambios sin guardar en app/. Después hay que comprobar el resultado contra
# el código sin migrar con docs/qa/barrido.js (ver docs/superpowers/plans/2026-11-01-migracion-tailwind-completa.md).
set -e
BASE="${1:-rroque100/main}"
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/../.."

rm -rf app
git checkout "$BASE" -- app
git reset -q app

# 1. Poda previa: las reglas de clases que ya nadie usa (primaryButton, secondaryButton…). Sin ella la herramienta conserva
#    los contenedores que las nombran (`.legalWorkspace .primaryButton`) y no los migra.
node scripts/css-podar.mjs --aplicar --tambien-desconocidas > /dev/null
# 2. Clases que el código arma o devuelve desde una función y que la herramienta no ve en un className.
node "$DIR/pre.mjs" > /dev/null
# 3. La migración. `--tw-condicional` activa `fuera-tw*:`, `legado:` y los escalones (ver la cabecera de la herramienta).
node scripts/migrar-a-tailwind.mjs --todo "--marcar=admisPanel,verif" "--forzar=aviso" "--sin-tw=searchAssistantTrigger" --tw-condicional --aplicar > /tmp/todo-aplicado.txt 2>&1
head -1 /tmp/todo-aplicado.txt
node "$DIR/renombrar.mjs" > /dev/null
node "$DIR/retoques.mjs" > /dev/null
# 4. Poda final: lo que ya está en utilidades. Los marcadores que solo busca un querySelector se dan por muertos a mano.
node scripts/css-podar.mjs --aplicar --tambien-desconocidas "--muertas=brand,copiloto,anexo1Preview,certificacionPreview,modalBody,hojaPreview,admisPanel,verif,aviso" | tail -1
# 5. Lo que sobrevive pasa a app/base.css; luego, lo que se migró a mano.
node "$DIR/finalizar.mjs" > /dev/null
node "$DIR/manual.mjs"
ls app/*.css
