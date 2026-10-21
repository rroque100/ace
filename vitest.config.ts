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
    // _manual-eval toca Supabase/Pinecone/OpenAI reales (red + BD en vivo) y no
    // debe correr en el suite por defecto ni en CI. Ejecutarlo a proposito con:
    //   npx vitest run tests/_manual-eval.test.ts
    exclude: ["**/node_modules/**", "tests/_manual-eval.test.ts"],
  },
});
