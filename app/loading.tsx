export default function Loading() {
  return <main className="workspaceLoading" role="status" aria-live="polite">
    <span className="workspaceLoadingMark" aria-hidden>A</span>
    <p>Abriendo tu espacio de trabajo…</p>
    <div className="workspaceLoadingTrack" aria-hidden><span/></div>
  </main>;
}
