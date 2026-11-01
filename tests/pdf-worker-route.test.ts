import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),read:vi.fn()}));
vi.mock("@/lib/auth",()=>({requireUser:mocks.auth}));
vi.mock("node:fs/promises",()=>({readFile:mocks.read}));
import { GET } from "@/app/api/documents/pdf-worker/route";
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue({user:{id:"person"}});});
describe("self-hosted PDF reader",()=>{
  it("does not read or serve code when the session is rejected",async()=>{
    mocks.auth.mockResolvedValue({error:new Response("Sin sesión",{status:401})});
    expect((await GET()).status).toBe(401);expect(mocks.read).not.toHaveBeenCalled();
  });
  it("serves the installed worker as JavaScript without using AI quota",async()=>{
    mocks.read.mockResolvedValue("export const WorkerMessageHandler = {};");
    const result=await GET();
    expect(result.status).toBe(200);expect(result.headers.get("Content-Type")).toContain("text/javascript");
    expect(result.headers.get("Cache-Control")).toContain("private");
    expect(mocks.auth).toHaveBeenCalledWith({usesAI:false});
    expect(await result.text()).toContain("WorkerMessageHandler");
  });
  it("returns a retriable failure rather than an HTML document",async()=>{
    mocks.read.mockRejectedValue(new Error("missing asset"));
    const result=await GET();expect(result.status).toBe(503);
    expect(result.headers.get("Cache-Control")).toBe("no-store");
  });
});
