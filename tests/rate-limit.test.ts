import { describe, expect, it } from "vitest";
import {
  checkRateLimit,
  getRateLimitKey,
  RATE_LIMITS,
} from "@/lib/rate-limit";

const uniqueKey = (() => {
  let n = 0;
  return (prefix: string) => `${prefix}:${Date.now()}:${n++}`;
})();

describe("checkRateLimit (ventana deslizante en memoria)", () => {
  it("permite hasta max requests y luego bloquea", () => {
    const key = uniqueKey("test");
    const config = { max: 3, windowMs: 60_000 };

    for (let i = 0; i < 3; i += 1) {
      const rl = checkRateLimit(key, config);
      expect(rl.allowed).toBe(true);
      expect(rl.limit).toBe(3);
    }

    const blocked = checkRateLimit(key, config);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetIn).toBeGreaterThan(0);
  });

  it("decrementa remaining en cada request permitida", () => {
    const key = uniqueKey("test");
    const config = { max: 2, windowMs: 60_000 };

    expect(checkRateLimit(key, config).remaining).toBe(1);
    expect(checkRateLimit(key, config).remaining).toBe(0);
  });

  it("aisla los buckets por key (endpoint/usuario distinto)", () => {
    const config = { max: 1, windowMs: 60_000 };
    const a = uniqueKey("a");
    const b = uniqueKey("b");

    expect(checkRateLimit(a, config).allowed).toBe(true);
    expect(checkRateLimit(a, config).allowed).toBe(false);
    // Otra key sigue teniendo su cupo intacto.
    expect(checkRateLimit(b, config).allowed).toBe(true);
  });

  it("libera el cupo cuando la ventana ya paso", () => {
    const key = uniqueKey("test");
    const config = { max: 1, windowMs: 30 };

    expect(checkRateLimit(key, config).allowed).toBe(true);
    expect(checkRateLimit(key, config).allowed).toBe(false);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(checkRateLimit(key, config).allowed).toBe(true);
        resolve();
      }, 50);
    });
  });
});

describe("getRateLimitKey", () => {
  const req = (headers: Record<string, string> = {}) =>
    new Request("https://ace.local/api/chat", { headers });

  it("prioriza el userId cuando hay sesion", () => {
    expect(getRateLimitKey(req(), "user-123", "chat")).toBe("chat:user:user-123");
  });

  it("cae a la IP de x-forwarded-for para anonimos", () => {
    const key = getRateLimitKey(req({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }), null, "search");
    expect(key).toBe("search:ip:203.0.113.9");
  });

  it("usa 'anonymous' si no hay userId ni IP", () => {
    expect(getRateLimitKey(req(), null, "analyze")).toBe("analyze:ip:anonymous");
  });
});

describe("RATE_LIMITS (presupuestos por endpoint)", () => {
  it("chat es mas estricto que aiSearch", () => {
    expect(RATE_LIMITS.chat.max).toBeLessThan(RATE_LIMITS.aiSearch.max);
  });

  it("todas las configuraciones tienen ventana positiva", () => {
    for (const cfg of Object.values(RATE_LIMITS)) {
      expect(cfg.max).toBeGreaterThan(0);
      expect(cfg.windowMs).toBeGreaterThan(0);
    }
  });
});
