import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rodizium",
  description: "Quem come mais no rodízio? Agora tem placar.",
  appleWebApp: {
    capable: true,
    title: "Rodizium",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#d33d15",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <div id="app">
          <AuthProvider>{children}</AuthProvider>
        </div>
      </body>
    </html>
  );
}
