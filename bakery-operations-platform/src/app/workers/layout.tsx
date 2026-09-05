export const metadata = {
  title: "אחראי משמרת",
  manifest: "/workers.webmanifest",
  icons: {
    icon: [
      { url: "/icons/logo-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/logo-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/logo-apple.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">{children}</div>
  );
}
