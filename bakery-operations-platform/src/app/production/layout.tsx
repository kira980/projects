import { getLocale } from "@/lib/i18n/locale-actions";
import { LocaleProvider } from "@/lib/i18n/locale-context";
import { LanguageSwitcher } from "@/components/language-switcher";

export const metadata = {
  title: "מסך אפייה",
  // Default for the production area (login + delivery prep). The takeaway
  // route overrides this with its own manifest, so each screen installs as
  // its own home-screen app that opens straight into that screen.
  manifest: "/production-delivery.webmanifest",
  icons: {
    icon: [
      { url: "/icons/baker-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/baker-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/baker-apple.png", sizes: "180x180", type: "image/png" }],
  },
};

export default async function ProductionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <LocaleProvider locale={locale}>
      <div className="flex min-h-dvh flex-col bg-muted/40">
        <div className="flex justify-end p-2">
          <LanguageSwitcher />
        </div>
        {children}
      </div>
    </LocaleProvider>
  );
}
