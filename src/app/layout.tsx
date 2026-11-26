import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radiestesia — registro de sessões",
  description:
    "Registro de anamnese, leitura de lâminas e síntese simbólica revisada pelo terapeuta.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#121318",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh">
        <header className="sticky top-0 z-20 border-b border-[var(--color-borda)] bg-[var(--color-fundo)]/95 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              Radiestesia
            </Link>
            <nav className="flex gap-1 text-sm">
              <Link
                href="/laminas"
                className="rounded-md px-2.5 py-1.5 text-[var(--color-texto-2)] hover:text-[var(--color-texto)]"
              >
                Lâminas
              </Link>
              <Link
                href="/ajustes"
                className="rounded-md px-2.5 py-1.5 text-[var(--color-texto-2)] hover:text-[var(--color-texto)]"
              >
                Ajustes
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 pb-24 pt-5">{children}</main>
        <footer className="mx-auto max-w-2xl px-4 pb-10 text-xs leading-relaxed text-[var(--color-texto-2)]">
          As interpretações aqui são simbólicas e passam por revisão do
          terapeuta. Não são diagnóstico, prescrição ou previsão. Os dados ficam
          guardados somente neste aparelho.
        </footer>
      </body>
    </html>
  );
}
