export const metadata = {
  title: "נוכחות",
  manifest: "/attendance.webmanifest",
  icons: {
    icon: [
      { url: "/icons/logo-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/logo-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/logo-apple.png", sizes: "180x180", type: "image/png" }],
  },
};

/**
 * The worker's own phone app: one screen, one button. Mobile-first and
 * deliberately plain — it is opened half-asleep at 03:00, outdoors.
 */
export default function AttendanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex min-h-dvh flex-col bg-muted/40">{children}</div>;
}
