/**
 * Streaming fallback for dashboard pages — shows instantly on navigation
 * while the server component fetches data.
 */
export default function DashboardLoading() {
  return (
    <div className="grid gap-4" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-40 animate-pulse rounded-xl bg-muted" />
      <div className="h-40 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
