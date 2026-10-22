import { afterEach, expect, it, vi } from "vitest";
import { uploadLargeOfficialPdf } from "../lib/official-import/upload";
afterEach(()=>vi.unstubAllGlobals());
it("envía un PDF grande en bloques de 6 MiB sin sobrescritura",async()=>{
  const sizes:number[]=[];let offset=0;
  vi.stubGlobal("fetch",vi.fn(async(_url,init)=>{
    if(init.method==="POST")return new Response(null,{status:201,headers:{location:"https://abc.storage.supabase.co/storage/v1/upload/resumable/id"}});
    sizes.push(init.body.byteLength);offset+=init.body.byteLength;
    expect(init.headers["Upload-Offset"]).toBe(String(offset-init.body.byteLength));
    return new Response(null,{status:204,headers:{"upload-offset":String(offset)}});
  }));
  await uploadLargeOfficialPdf({supabaseUrl:"https://abc.supabase.co",serviceRoleKey:"test",bucket:"documents",objectPath:"official/test.pdf",bytes:Buffer.alloc(13*1024*1024)});
  expect(sizes).toEqual([6*1024*1024,6*1024*1024,1024*1024]);
});
it("no envía credenciales a un destino TUS diferente",async()=>{
  const fetchMock=vi.fn(async()=>new Response(null,{status:201,headers:{location:"https://evil.test/upload"}}));vi.stubGlobal("fetch",fetchMock);
  await expect(uploadLargeOfficialPdf({supabaseUrl:"https://abc.supabase.co",serviceRoleKey:"test",bucket:"documents",objectPath:"official/test.pdf",bytes:Buffer.from("%PDF-")})).rejects.toThrow("no autorizada");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
