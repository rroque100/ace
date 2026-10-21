// Fuente ÚNICA de la navegación lateral. AppShell (servidor) la filtra por rol y
// la pasa a <Sidebar> (cliente). No duplicar el array en los componentes: antes
// había dos copias (app-shell.tsx y sidebar.tsx) y divergieron.
//
// El icono se guarda como NOMBRE (string), no como el componente de lucide-react:
// AppShell es un Server Component y pasa esta estructura como prop al <Sidebar>,
// que es de cliente. Los componentes/funciones no se pueden serializar a través
// de ese límite —React lanzaba "Only plain objects can be passed to Client
// Components"—, así que aquí solo van datos planos y el <Sidebar> resuelve el
// nombre a su icono. `IconName` mantiene el nombre acotado a los iconos reales.
export type IconName =
  | "BookOpenCheck"
  | "Bot"
  | "FileSearch"
  | "Library"
  | "Archive"
  | "ShieldCheck"
  | "ScanSearch"
  | "GitCompare"
  | "ClipboardList"
  | "Briefcase"
  | "FileText"
  | "Bookmark"
  | "History"
  | "Bell"
  | "UploadCloud"
  | "BarChart3"
  | "Activity"
  | "ScrollText"
  | "Settings";

export const NAVEGACION = [
  {
    items: [{ href: "/", icon: "BookOpenCheck", id: "panel", label: "Inicio", adminOnly: false }],
    label: "General",
  },
  {
    items: [
      // Necesidades queda FUERA a propósito: la crea y gestiona el área
      // usuaria que pide algo (cualquier oficina, no solo Abastecimiento);
      // solo Expedientes y Contratos son trabajo exclusivo de la DEC.
      { href: "/necesidades", icon: "ClipboardList", id: "necesidades", label: "Necesidades", adminOnly: false },
      { href: "/expedientes", icon: "Briefcase", id: "expedientes", label: "Expedientes", adminOnly: false, soloAbastecimiento: true },
      { href: "/contratos", icon: "FileText", id: "contratos", label: "Contratos", adminOnly: false, soloAbastecimiento: true },
    ],
    label: "Procesos",
  },
  {
    items: [
      { href: "/chat", icon: "Bot", id: "chat", label: "Chat con fuentes", adminOnly: false },
      { href: "/busqueda", icon: "FileSearch", id: "busqueda", label: "Búsqueda documental", adminOnly: false },
      { href: "/normas", icon: "Library", id: "normas", label: "Normas por artículo", adminOnly: false },
      { href: "/archivo", icon: "Archive", id: "archivo", label: "Archivo documental", adminOnly: false },
    ],
    label: "Consultar",
  },
  {
    items: [
      { href: "/validar", icon: "ShieldCheck", id: "validar", label: "Validar procedimiento", adminOnly: false },
      { href: "/analizar", icon: "ScanSearch", id: "analizar", label: "Analizar documento", adminOnly: false },
      { href: "/comparar", icon: "GitCompare", id: "comparar", label: "Comparar normas", adminOnly: false },
    ],
    label: "Revisar",
  },
  {
    items: [
      { href: "/expedientes-archivo", icon: "Library", id: "expedientes-archivo", label: "Biblioteca expedientes", adminOnly: false },
    ],
    label: "Trabajo",
  },
  {
    items: [
      { href: "/guardado", icon: "Bookmark", id: "guardado", label: "Guardados", adminOnly: false },
      { href: "/historial", icon: "History", id: "historial", label: "Historial", adminOnly: false },
      { href: "/alertas", icon: "Bell", id: "alertas", label: "Alertas", adminOnly: false },
    ],
    label: "Organizar",
  },
  {
    items: [
      { href: "/documentos", icon: "UploadCloud", id: "documentos", label: "Biblioteca PDF", adminOnly: false },
      { href: "/evaluacion", icon: "BarChart3", id: "evaluacion", label: "Evaluación IA", adminOnly: true, requiredRole: "Admin" },
      { href: "/metricas", icon: "Activity", id: "metricas", label: "Monitoreo", adminOnly: true, requiredRole: "Admin" },
      { href: "/auditoria", icon: "ScrollText", id: "auditoria", label: "Auditoría", adminOnly: true, requiredRole: "Admin" },
      { href: "/configuracion", icon: "Settings", id: "configuracion", label: "Configuración", adminOnly: true, requiredRole: "Admin" },
    ],
    label: "Administrar",
  },
] as const satisfies ReadonlyArray<{
  label: string;
  items: ReadonlyArray<{
    href: string;
    icon: IconName;
    id: string;
    label: string;
    adminOnly: boolean;
    requiredRole?: string;
    /** Expedientes/Contratos: exclusivo de la oficina de Abastecimiento. */
    soloAbastecimiento?: boolean;
  }>;
}>;

export type NavItem = (typeof NAVEGACION)[number]["items"][number];
export type NavSection = (typeof NAVEGACION)[number];

export type ActiveId = NavItem["id"];
