export type ReadingPreferences = { size:number; font:"serif"|"sans"; spacing:"comfortable"|"compact" };
export const DEFAULT_READING: ReadingPreferences = {size:18,font:"serif",spacing:"comfortable"};
export function readingPreferences(raw:string): ReadingPreferences {
  try {
    const value=JSON.parse(raw);
    return {size:[16,18,20,22,24].includes(value?.size)?value.size:18,
      font:value?.font==="sans"?"sans":"serif",spacing:value?.spacing==="compact"?"compact":"comfortable"};
  } catch { return DEFAULT_READING; }
}
/** Visual boundaries only. Joining the blocks recovers every original character. */
export function legalReadingBlocks(content:string):string[] {
  const breaks=new Set<number>([0,content.length]);
  for(const match of content.matchAll(/\n[\t ]*\n+/g))breaks.add(match.index+match[0].length);
  const markers:Array<{start:number;group:string;order:number}>=[];
  for(const match of content.matchAll(/(^|\s)(?:([a-zñ])\)|([0-9]{1,3})\.([0-9]{1,2})\.?)\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡])/gu)) {
    const start=match.index+match[1].length;
    if(/(?:art[íi]culo|numeral|literal|inciso|p[áa]gina)\s*$/iu.test(content.slice(Math.max(0,start-24),start)))continue;
    markers.push({start,group:match[2]?"letters":match[3],order:match[2]?"abcdefghijklmnñopqrstuvwxyz".indexOf(match[2]):Number(match[4])});
  }
  for(let i=1;i<markers.length;i++) {
    const previous=markers[i-1],current=markers[i];
    if(current.group===previous.group&&current.order===previous.order+1){breaks.add(previous.start);breaks.add(current.start);}
  }
  const offsets=[...breaks].sort((a,b)=>a-b);
  return offsets.slice(0,-1).map((start,index)=>content.slice(start,offsets[index+1]));
}
