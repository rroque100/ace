#!/usr/bin/env node

const baseUrl = (process.env.ACE_APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const cookie = process.env.ACE_SESSION_COOKIE || "";

async function readJson(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  return { payload, response };
}

function assertOk(name, condition, detail) {
  const status = condition ? "OK" : "FAIL";
  console.log(`${status} ${name}${detail ? ` - ${detail}` : ""}`);
  return condition;
}

async function main() {
  console.log(`ACE operational smoke test -> ${baseUrl}`);
  const results = [];

  const health = await readJson("/api/health");
  results.push(assertOk("health", health.response.ok && health.payload.ok === true));

  const integrations = await readJson("/api/integrations/health");
  results.push(
    assertOk(
      "integrations",
      integrations.response.ok && integrations.payload.ok === true,
      integrations.payload.ok ? "OpenAI/Pinecone/Supabase conectados" : JSON.stringify(integrations.payload),
    ),
  );

  const protectedApi = await readJson("/api/chat");
  results.push(
    assertOk(
      "private APIs protected",
      protectedApi.response.status === 401 || protectedApi.response.status === 405,
      `status ${protectedApi.response.status}`,
    ),
  );

  if (cookie) {
    const verification = await readJson("/api/system/verify");
    results.push(
      assertOk(
        "admin system verification",
        verification.response.ok && verification.payload.summary,
        verification.response.ok
          ? `${verification.payload.summary.passed}/${verification.payload.summary.total} checks`
          : JSON.stringify(verification.payload),
      ),
    );

    if (verification.response.ok) {
      results.push(
        assertOk(
          "corpus critical readiness",
          verification.payload.corpus?.corpusReady === true,
          verification.payload.corpus?.corpusReady
            ? "corpus listo"
            : "revisar cobertura de Ley 32069 / Reglamento D.S. 009-2025-EF, opiniones OECE, páginas o indexado en Pinecone",
        ),
      );
    }
  } else {
    console.log("SKIP admin system verification - define ACE_SESSION_COOKIE con una cookie admin.");
  }

  if (results.some((item) => !item)) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
