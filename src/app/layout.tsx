import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radiestesia — registro de sessões",
  description:
    "Registro de anamnese, leitura de lâminas e síntese simbólica montada pelo aplicativo.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#111216",
  width: "device-width",
  initialScale: 1,
  // Sem maximumScale: travar o zoom impede quem precisa aumentar o texto.
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
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-2 py-1.5">
            <Link
              href="/"
              className="btn btn-discreto btn-pequeno font-semibold tracking-tight text-[var(--color-texto)]"
            >
              Radiestesia
            </Link>
            <nav className="flex gap-0.5 text-sm">
              <Link href="/laminas" className="btn btn-discreto btn-pequeno">
                Lâminas
              </Link>
              <Link href="/ajustes" className="btn btn-discreto btn-pequeno">
                Ajustes
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 pb-10 pt-5">{children}</main>
        <footer className="mx-auto max-w-2xl px-4 pb-10 text-xs leading-relaxed text-[var(--color-texto-2)]">
          As interpretações aqui são simbólicas e saem do que foi registrado
          na sessão. Não são diagnóstico, prescrição ou previsão. O cadastro
          fica guardado somente neste aparelho; quando você usa a camada de IA,
          só a pergunta da leitura e trechos da ficha saem daqui, sem nome nem
          contato.
        </footer>
      </body>
    </html>
  );
}
