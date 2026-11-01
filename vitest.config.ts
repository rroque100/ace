import { defineConfig } from "vitest/config";

// Tests unitarios de la logica de dominio determinista (reglas de procedencia,
// deteccion de citas, taxonomia, normalizacion de documentos). No tocan red ni BD:
// si un test necesita Supabase/Pinecone/OpenAI, mockear esas dependencias.
// resolve.tsconfigPaths resuelve el alias "@/*" del tsconfig nativamente.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    // Varios tests generan o abren .xlsx/.docx reales (exceljs, jszip, plantillas OECE de ~MB) y el primero de cada
    // fichero paga además la importación en frío. Con los 5 s por defecto pasaban en local y fallaban en CI
    // (runner compartido) con «Test timed out in 5000ms» en cui-en-vivo y bases-docx, sin que hubiera ningún error
    // de lógica. Un test que de verdad se cuelgue sigue fallando, solo que a los 30 s.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // _manual-eval toca Supabase/Pinecone/OpenAI reales (red + BD en vivo) y no
    // debe correr en el suite por defecto ni en CI. Ejecutarlo a proposito con:
    //   npx vitest run tests/_manual-eval.test.ts
    exclude: ["**/node_modules/**", "tests/_manual-eval.test.ts"],
  },
});
