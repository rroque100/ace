import { expect, it, vi } from "vitest";
import { acquireVoiceStream, voiceCaptureError } from "@/lib/voice-capture";

it("distingue permiso, dispositivo ausente, ocupado y grabador", () => {
  expect(voiceCaptureError({ name: "NotAllowedError" }, "microphone")).toContain("bloqueado");
  expect(voiceCaptureError({ name: "NotFoundError" }, "microphone")).toContain("No se encontró");
  expect(voiceCaptureError({ name: "NotReadableError" }, "microphone")).toContain("otras aplicaciones");
  expect(voiceCaptureError(new Error(), "recorder")).toContain("El micrófono se abrió");
});
it("reintenta sin restricciones solo cuando son incompatibles", async () => {
  const stream = {} as MediaStream;
  const getUserMedia = vi.fn().mockRejectedValueOnce({ name: "OverconstrainedError" }).mockResolvedValueOnce(stream);
  await expect(acquireVoiceStream({ getUserMedia })).resolves.toBe(stream);
  expect(getUserMedia).toHaveBeenLastCalledWith({ audio: true });
});
it("no repite la petición si se deniega el permiso o falla el dispositivo", async () => {
  for (const name of ["NotAllowedError", "NotReadableError", "NotFoundError"]) {
    const error = { name }; const getUserMedia = vi.fn().mockRejectedValue(error);
    await expect(acquireVoiceStream({ getUserMedia })).rejects.toBe(error);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  }
});
