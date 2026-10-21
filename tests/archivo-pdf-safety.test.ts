import { describe, expect, it } from "vitest";
import { classifyPdfError } from "../lib/pdf-read-error";
import { signUploadTicket, verifyUploadTicket } from "../lib/archivo-upload-ticket";

describe("lectura de PDF", () => {
  it("no culpa al documento cuando falta el worker", () => {
    const error = classifyPdfError(new Error("Setting up fake worker failed: Cannot find module pdf.worker.mjs"));
    expect(error.status).toBe(503);
    expect(error.retryable).toBe(true);
  });
  it("distingue archivos protegidos", () => expect(classifyPdfError(new Error("PasswordException")).status).toBe(422));
});
describe("referencias de subida", () => {
  const data = { userId: "alice", path: "archivo-temp/alice/a.pdf", name: "a.pdf", size: 4000000, expires: Date.now() + 100000 };
  it("acepta al propietario y rechaza a otro usuario", () => {
    const token = signUploadTicket(data, "test-secret");
    expect(verifyUploadTicket(token, "alice", "test-secret")).toEqual(data);
    expect(() => verifyUploadTicket(token, "bob", "test-secret")).toThrow();
  });
  it("rechaza firmas alteradas y referencias vencidas", () => {
    expect(() => verifyUploadTicket(signUploadTicket(data, "wrong"), "alice", "test-secret")).toThrow();
    expect(() => verifyUploadTicket(signUploadTicket({ ...data, expires: 1 }, "test-secret"), "alice", "test-secret")).toThrow();
  });
});
