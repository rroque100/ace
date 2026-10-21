import { readFile, access } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const dist = process.argv[2] || ".next";
const trace = path.resolve(dist, "server/app/api/expedientes-archivo/extract/route.js.nft.json");
const { files } = JSON.parse(await readFile(trace, "utf8"));
const worker = files.find((file) => file.replaceAll("\\", "/").endsWith("pdfjs-dist/legacy/build/pdf.worker.mjs"));
assert.ok(worker, "Falta el worker en el paquete de /extract");
await access(path.resolve(path.dirname(trace), worker));
for (const asset of ["cmaps", "standard_fonts", "wasm"]) {
  assert.ok(files.some((file) => file.includes(`pdfjs-dist/${asset}/`)), `Faltan assets ${asset}`);
}
console.log("/extract: worker y recursos PDF incluidos y worker presente en disco.");
