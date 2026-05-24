import type { Metadata, Viewport } from "next";
import { Frank_Ruhl_Libre } from "next/font/google";
import "./globals.css";

const frankRuhl = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-frank-ruhl",
});

export const metadata: Metadata = {
  title: "תנ״ך יומי",
  description: "לימוד תנ״ך יומי עם פירוש שטיינזלץ",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "תנ״ך יומי",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1a2e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${frankRuhl.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-white text-gray-900 dark:bg-zinc-950 dark:text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
