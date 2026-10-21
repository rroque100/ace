import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "node_modules/**", "scripts/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // Regla experimental del React Compiler. Los usos actuales son efectos
      // legitimos de carga inicial (fetch on mount, restaurar borrador) y de
      // sincronizacion de estado derivado, no los renders en cascada que la
      // regla busca. Se mantiene como aviso visible sin bloquear el build.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Las declaraciones de tipos describen modulos AJENOS, y algunos son
    // CommonJS: `pdf-parse` exporta con `export =`, y la unica forma de
    // redeclararlo para su ruta profunda (`pdf-parse/lib/pdf-parse`, que es la
    // que usa lib/pdf-processing.ts) es `import x = require("pdf-parse")`.
    // Prohibirlo aqui no evita ningun `require` nuestro: solo impide describir
    // la libreria tal como es.
    files: ["**/*.d.ts"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);
