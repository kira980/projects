import { getLocale } from "@/lib/i18n/locale-actions";
import { LocaleProvider } from "@/lib/i18n/locale-context";
import { LanguageSwitcher } from "@/components/language-switcher";

export const metadata = {
  title: "אפליקציית נהג",
  manifest: "/driver.webmanifest",
  icons: {
    icon: [
      { url: "/icons/driver-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/driver-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/driver-apple.png", sizes: "180x180", type: "image/png" }],
  },
};

export default async function DriverLayout({
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
