import {z} from "zod";
const snapshotSchema=z.object({version:z.literal(1),updatedAt:z.number(),question:z.string().max(12000),scroll:z.number().min(0).max(1000000)});
export type ChatSnapshot=z.infer<typeof snapshotSchema>;
export function chatContinuityKey(owner:string,session:string|null){return `ace:chat:continuity:v1:${encodeURIComponent(owner)}:${session??"new"}`;}
export function readChatSnapshot(raw:string|null,now=Date.now()):ChatSnapshot|null {
 try{const result=snapshotSchema.safeParse(JSON.parse(raw??"null"));return result.success&&now-result.data.updatedAt<=24*60*60*1000&&result.data.updatedAt<=now+60000?result.data:null;}catch{return null;}
}
export function conversationUrl(current:string,id:string){const url=new URL(current);url.searchParams.set("sessionId",id);url.searchParams.delete("pregunta");return `${url.pathname}${url.search}${url.hash}`;}
