import type { NextConfig } from "next";
import { maxPdfSizeBytes } from "./lib/upload-limits";

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: maxPdfSizeBytes,
  },
  allowedDevOrigins: ['192.168.2.225', 'localhost'],
  // Modulos nativos/ESM que no deben empaquetarse en el server bundle: el OCR de
  // PDFs escaneados rasteriza con pdfjs-dist + el addon nativo @napi-rs/canvas.
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  // Incluye las plantillas .xlsx oficiales (FASE 1) en el bundle serverless para
  // que las rutas de exportación puedan leerlas en producción.
  //
  // pdfjs-dist va aparte: al ser `serverExternalPackages` (no se empaqueta con
  // webpack), lo que se despliega depende de que el rastreador de Vercel/Netlify
  // detecte sus imports. El de `pdf.worker.mjs` que hace `pdf.mjs` para el
  // "fake worker" de Node NO es estático, así que el rastreo lo deja fuera y en
  // producción falla con "Cannot find module '.../pdf.worker.mjs'" — el PDF
  // parece "dañado o protegido" cuando el problema es el despliegue, no el
  // archivo. Los assets de `cmaps/standard_fonts/wasm/iccs` que ya resuelve
  // `getPdfjsAssetOptions` (lib/pdf-processing.ts) tienen el mismo problema.
  // `/api/**/*` porque el OCR de PDF lo usan 14 rutas de api/ distintas
  // (documents, necesidades/eett-tdr, expedientes-archivo, contratos-sie...).
  outputFileTracingIncludes: {
    "/api/processes/**": ["./lib/plantillas-f1/**"],
    "/api/**/*": [
      "./node_modules/pdfjs-dist/legacy/build/**",
      "./node_modules/pdfjs-dist/cmaps/**",
      "./node_modules/pdfjs-dist/iccs/**",
      "./node_modules/pdfjs-dist/standard_fonts/**",
      "./node_modules/pdfjs-dist/wasm/**",
    ],
  },
  // Carpeta de salida. Por defecto `.next`, la misma que usa `next dev`: lanzar
  // un build de medición con el servidor de desarrollo levantado le pisaba los
  // artefactos y lo tumbaba. Con esto se puede compilar aparte
  // (NEXT_DIST_DIR=.next-medicion npx next build) sin tocar el que está en uso.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  // Cabeceras de seguridad para TODAS las respuestas. Antes vivían solo en
  // netlify.toml (atadas a Netlify); aquí son portables y se aplican también en
  // Vercel. El cacheo inmutable de /_next/static/* lo hace Vercel por su cuenta,
  // así que no se replica.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // SAMEORIGIN, no DENY: la app enmarca sus propios PDFs en un
          // <iframe> (vista previa de expedientes/documentos/archivo/EETT) --
          // con DENY el navegador se negaba a mostrarlos aunque el archivo
          // cargara bien directo por URL (confirmado: mismo PDF, mismo
          // servidor, solo fallaba dentro del iframe). SAMEORIGIN da la
          // misma protección real contra clickjacking (un sitio externo
          // sigue sin poder enmarcarte) sin romper el uso propio.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
