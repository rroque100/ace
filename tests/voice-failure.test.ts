import { expect, it } from "vitest";
import { z } from "zod";
import { voiceFailure } from "@/lib/voice-failure";

it("el usuario que cancela no es un fallo", () => {
  expect(voiceFailure(new DOMException("aborted", "AbortError")).kind).toBe("cancelada");
});

it("un audio sin habla (transcripción vacía) se distingue de un fallo del proveedor", () => {
  const vacio = z.object({ text: z.string().trim().min(3) }).safeParse({ text: "" });
  expect(vacio.success).toBe(false);
  expect(voiceFailure(vacio.error).kind).toBe("sin-texto");
});

it("el tiempo agotado y el HTTP del proveedor sí son fallos del proveedor, con su causa", () => {
  expect(voiceFailure(new DOMException("signal timed out", "TimeoutError"))).toMatchObject({ kind: "proveedor", detail: expect.stringContaining("TimeoutError") });
  expect(voiceFailure(new Error("Voice provider HTTP 400"))).toEqual({ kind: "proveedor", detail: "Error: Voice provider HTTP 400" });
  expect(voiceFailure("algo raro").kind).toBe("proveedor");
  expect(voiceFailure(undefined).kind).toBe("proveedor");
});

it("no deja claves en el log y acota la longitud", () => {
  const sk = "sk-proj-AbCdEfGhIjKlMnOp";
  const google = "AIzaSyA1B2C3D4E5F6G7H8";
  const detail = voiceFailure(new Error(`Incorrect API key provided: ${sk}. also ${google} and Bearer abcdef123456.\n${"x".repeat(1000)}`)).detail;
  expect(detail).not.toContain(sk);
  expect(detail).not.toContain(google);
  expect(detail).not.toContain("abcdef123456");
  expect(detail).toContain("[clave]");
  expect(detail.length).toBeLessThan(270);
  expect(detail).not.toContain("\n");
});
