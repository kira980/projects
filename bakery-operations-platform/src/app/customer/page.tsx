export const metadata = { title: "פורטל לקוחות" };

/**
 * Future customer ordering portal (Stage 15 — not built yet).
 * The database already supports it: customer_users links auth users to
 * customers, customer_product_prices drives the personal menu, and the
 * same pricing logic used by admin orders will be reused here.
 */
export default function CustomerPortalPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-muted/40 p-6 text-center">
      <span className="text-6xl">🥖</span>
      <h1 className="text-3xl font-bold">פורטל הלקוחות בדרך</h1>
      <p className="max-w-md text-muted-foreground">
        בקרוב תוכלו להתחבר, לראות את התפריט והמחירים האישיים שלכם ולהזמין
        אונליין. בינתיים אפשר להזמין בטלפון.
      </p>
    </main>
  );
}
