import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ANATOMI — buatan Ardellio Satria Anindito",
  description:
    "ANATOMI · Model Visualisasi Anatomi Manusia 3D Interaktif buatan Ardellio Satria Anindito. Rangka, otot, organ, pembuluh koroner, peredaran darah, pernapasan, saraf, endokrin, dan kemih dengan akurasi anatomis tinggi, dukungan skrip cerdas, dan layar penuh.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ANATOMI",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
