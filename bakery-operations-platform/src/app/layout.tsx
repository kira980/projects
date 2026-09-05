import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { InstallButton } from "@/components/install-button";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: {
    default: "מאפיית אורן — מערכת ניהול",
    template: "%s | מאפיית אורן",
  },
  description: "מערכת ניהול תפעולית למאפייה — הזמנות, ייצור, משלוחים, עובדים וספקים",
  // Default (admin) app manifest. The kiosk / driver / production layouts
  // override this so each installs as its own home-screen app.
  manifest: "/dashboard.webmanifest",
  icons: {
    icon: [
      { url: "/icons/logo-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/logo-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/logo-apple.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {/* Capture beforeinstallprompt as early as possible — it can fire
            before React hydrates, so a late listener would miss it. The
            InstallButton reads window.__bip and the dispatched `bip` event. */}
        <script
          id="bip-capture"
          dangerouslySetInnerHTML={{
            __html:
              "window.__bip=null;addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__bip=e;dispatchEvent(new Event('bip'))});addEventListener('appinstalled',function(){window.__bip=null;dispatchEvent(new Event('bip'))});",
          }}
        />
        {children}
        <InstallButton />
        <Toaster position="top-center" richColors dir="rtl" />
      </body>
    </html>
  );
}
