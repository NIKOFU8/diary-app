import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import AuthProvider from "@/components/auth/AuthProvider";
import AuthGate from "@/components/auth/AuthGate";

export const metadata: Metadata = {
  title: "まいにち日記",
  description: "1問1答で気軽に続けられる、あなただけの日記アプリ",
  applicationName: "まいにち日記",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "まいにち日記",
  },
  icons: { icon: "/icon.svg" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        <AuthProvider>
          <AuthGate>
            <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-slate-50 shadow-sm">
              {children}
            </div>
            <BottomNav />
          </AuthGate>
        </AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
