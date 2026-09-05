/**
 * Advertises the takeaway prep app's own manifest, overriding the production
 * area's default (delivery) manifest — so installing from this screen
 * installs "הכנות איסוף עצמי" as a separate home-screen app that opens straight
 * into takeaway prep. The parent production layout still provides the
 * LocaleProvider shell and chrome; this only sets metadata.
 */
export const metadata = {
  manifest: "/production-takeaway.webmanifest",
};

export default function ProductionTakeawayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
