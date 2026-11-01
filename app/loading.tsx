export default function Loading(){
 return <main className="flex min-h-[80dvh] flex-col items-center justify-center gap-5 bg-canvas px-6 text-muted" role="status" aria-live="polite">
   <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-2xl font-bold text-brand" aria-hidden>A</span>
   <p className="text-sm font-medium">Abriendo tu espacio de trabajo…</p>
   <span className="h-1 w-36 animate-pulse rounded-full bg-brand/25 motion-reduce:animate-none" aria-hidden/>
 </main>;
}
