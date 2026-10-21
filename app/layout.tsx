import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./styles.css";
import "./tailwind.css";
import "./components/expedientes-archivo/expedientes-archivo.css";
import { YearProvider } from "@/lib/year-context";
import { ToastProvider, ToastContainer } from "@/lib/toast";

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
  title: "ACE IA Juridica",
  description: "Gestion documental, busqueda semantica y asistencia juridica con IA.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.variable}>
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
