export const metadata = {
  title: "הכנסות",
  manifest: "/secret.webmanifest",
  // Never let a search engine or a link preview touch this one.
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/icons/logo-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/logo-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/logo-apple.png", sizes: "180x180", type: "image/png" }],
  },
};

/**
 * The owner's private takings app. Two things are needed to see a number
 * here: the admin login that guards every dashboard route, and the
 * passphrase that never leaves this device.
 */
export default function SecretLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex min-h-dvh flex-col bg-muted/40">{children}</div>;
}
