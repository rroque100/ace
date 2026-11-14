import { schedule } from "@netlify/functions";

// Evaluación continua de calidad del chat jurídico: corre los casos revisados por el
// pipeline real y registra regresiones (ver app/api/chat/quality/auto/route.ts). Se
// programa de madrugada en Perú (09:00 UTC = 04:00 PET) para no competir con el uso
// del día; la pasada usa persist:false y no toca conversaciones de usuarios.
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

  try {
    const response = await fetch(`${baseUrl}/api/chat/quality/auto`, {
      method: "POST",
      headers,
      body: JSON.stringify({ limit: 4 }),
    });
    const text = await response.text();
    console.log(
      `[${new Date().toISOString()}] calidad-juridica status=${response.status} body=${text.slice(0, 500)}`,
    );
    // 409 = sin casos revisados aún: correcto y sin alerta; 503 = SQL sin aplicar.
    return new Response(text, { status: response.status === 409 ? 200 : response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${new Date().toISOString()}] calidad-juridica error=${message}`);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export default schedule("0 9 * * *", handler);
