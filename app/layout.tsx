import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./styles.css";
import "./tailwind.css";
import "./components/expedientes-archivo/expedientes-archivo.css";
import { YearProvider } from "@/lib/year-context";
import { ToastProvider, ToastContainer } from "@/lib/toast";
import { THEME_BOOTSTRAP } from "@/lib/theme";
import "./workspace.css";

/**
 * Inter, autoalojada por Next en el build.
 *
 * Antes la interfaz usaba Arial —la que trae el sistema—, que en pantallas de
 * datos se lee apretada y con cifras de ancho variable. Inter está dibujada para
 * interfaces: tiene cifras tabulares (columnas de importes que no bailan) y
 * alternativas estilísticas para la "l" y el "1", que en un RUC o un DNI importa.
 *
 * `next/font` la descarga al compilar y la sirve desde el propio dominio: sin
 * petición a Google en cada carga y sin el parpadeo de fuente que provoca un
 * `<link>` a un CDN.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--fuente-ui",
});

export const metadata: Metadata = {
  title: { default: "ACE · Contrataciones públicas", template: "%s · ACE" },
  description: "Consulta fuentes, estudia la normativa y prepara tus contrataciones públicas en un solo lugar.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "ACE" },
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f4f7fa" }, { media: "(prefers-color-scheme: dark)", color: "#101923" }],
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} /></head>
      <body suppressHydrationWarning>
        <YearProvider>
          <ToastProvider>
            {children}
            <ToastContainer />
          </ToastProvider>
        </YearProvider>
      </body>
    </html>
  );
}
