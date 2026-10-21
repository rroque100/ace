import { schedule } from "@netlify/functions";

// Colas a drenar en cada tick: corpus normativo y biblioteca de expedientes.
// Cada una tiene su propio `after()` como vía rápida; este drenado es la red de
// seguridad para los que quedaron atascados (timeout de OCR, invocación muerta).
const drainPaths = ["/api/documents/drain", "/api/expedientes-archivo/drain"];

const handler = async () => {
  const baseUrl = (process.env.URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const cronSecret = process.env.CRON_SECRET || "";

  if (!baseUrl) {
    return new Response("Missing URL env var", { status: 500 });
  }

  const headers = {
    "Content-Type": "application/json",
    ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
  };

  const results = [];
  for (const path of drainPaths) {
    try {
      const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers });
      const text = await response.text();
      console.log(
        `[${new Date().toISOString()}] drain ${path} status=${response.status} body=${text.slice(0, 500)}`,
      );
      results.push({ path, status: response.status, body: text.slice(0, 500) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${new Date().toISOString()}] drain ${path} error: ${message}`);
      results.push({ path, status: 500, error: message });
    }
  }

  const ok = results.every((r) => r.status >= 200 && r.status < 300);
  return new Response(JSON.stringify({ results }), {
    status: ok ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  });
};

export default schedule("@every 5m", handler);
