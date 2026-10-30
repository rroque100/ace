import { describe, expect, it } from "vitest";
import { sidebarIdentity, workspaceNavigation } from "@/lib/workspace-navigation";
import type { SessionUser } from "@/lib/auth";
import { validTheme } from "@/lib/theme";

const actor = (extra: Partial<SessionUser> = {}) => ({
  id:"person-1", accessToken:"secret-session-token", email:"persona@example.com",
  nombreCompleto:"Ana Pérez", role:"consulta", isAdmin:false, esExterno:false,
  modulosExternos:[], entity:null, esJefe:false, ...extra,
}) as SessionUser;
const paths = (user:SessionUser, processes=false) => workspaceNavigation(user,processes).flatMap(s=>s.items.map(i=>i.href));
describe("workspace permissions and client identity",()=>{
  it("never serializes session credentials to the sidebar",()=>{
    const safe = sidebarIdentity(actor());
    expect(safe?.nombreCompleto).toBe("Ana Pérez");
    expect(JSON.stringify(safe)).not.toContain("secret-session-token");
    expect(Object.keys(safe!)).not.toContain("accessToken");
    expect(sidebarIdentity(null)).toBeNull();
  });
  it("keeps a legal-only external user within their own tools",()=>{
    expect(paths(actor({esExterno:true,modulosExternos:["centro_juridico"]})))
      .toEqual(["/","/chat","/busqueda","/normas"]);
  });
  it("never uses an external admin flag to open staff modules",()=>{
    expect(paths(actor({esExterno:true,isAdmin:true,modulosExternos:["simulacro"]})))
      .toEqual(["/","/simulador"]);
  });
  it("keeps admin and procurement links closed without their permissions",()=>{
    expect(paths(actor())).not.toContain("/configuracion");
    expect(paths(actor())).not.toContain("/expedientes");
    expect(paths(actor(),true)).toContain("/expedientes");
    expect(paths(actor({isAdmin:true}))).toContain("/configuracion");
    expect(workspaceNavigation(null,true)).toEqual([]);
  });
  it("rejects corrupted stored appearance values",()=>{
    expect(validTheme("dark")).toBe("dark");
    expect(validTheme("light")).toBe("light");
    for(const value of ["red",null,{},"<script>"]) expect(validTheme(value)).toBe("system");
  });
});
