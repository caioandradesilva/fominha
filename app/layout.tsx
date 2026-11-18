import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fominha",
  description: "Quem come mais no rodízio? Agora tem placar.",
  appleWebApp: {
    capable: true,
    title: "Fominha",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#d33d15",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
