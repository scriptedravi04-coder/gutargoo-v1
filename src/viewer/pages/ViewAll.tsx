import { Link, useParams, useSearchParams } from "react-router-dom";
import { AppShell } from "@v/components/AppShell";
import { TopBar } from "@v/components/TopBar";
import { Img } from "@v/components/Img";
import { LockBadge } from "@v/components/LockBadge";
import { EmptyState, ErrorState } from "@v/components/States";
import { useCatalog } from "@v/hooks/useCatalog";
import { detailPath } from "@v/lib/content";

// Every title in one Home section, as a 3-column grid.
export default function ViewAll() {
  const { id } = useParams();
  const { sections, loading, error, refetch } = useCatalog();
  const [params] = useSearchParams();
  const c = params.get("c"); // opened from Home with Movies / Web Series / TV Shows selected
  const found = sections.find((s) => s.id === id);
  const filtered = found && c ? found.items.filter((it) => it.kind === c) : null;
  const section = found && filtered && filtered.length ? { ...found, items: filtered } : found;

  let body;
  if (loading) {
    body = (
      <div className="grid grid-cols-3 gap-2 px-3 pt-2 md:grid-cols-5 md:gap-4 md:px-0 xl:grid-cols-6 2xl:grid-cols-7">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i}>
            <div className="shimmer aspect-[.65] rounded-lg" />
            <div className="shimmer mx-auto mt-1.5 h-2.5 w-3/4 rounded" />
          </div>
        ))}
      </div>
    );
  } else if (error && !sections.length) {
    body = <ErrorState onRetry={() => void refetch()} />;
  } else if (!section) {
    body = <EmptyState title="Section not found" subtitle="It may have been removed. Go back to Home to keep watching." />;
  } else {
    body = (
      <div className="grid grid-cols-3 gap-2 px-3 pb-6 pt-2 md:grid-cols-4 md:gap-x-5 md:gap-y-7 md:px-0 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
        {section.items.map((it) => (
          <Link key={it.id} to={detailPath(it)} className="gp-card group block rounded-lg">
            <div className="relative aspect-[.65] overflow-hidden rounded-lg">
              <Img src={it.poster} alt={it.title} className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]" />
              {!it.isFree && <LockBadge />}
            </div>
            <p className="mt-1.5 line-clamp-2 text-center text-[11px] font-medium leading-tight text-white/90 md:text-left md:text-sm">{it.title}</p>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <AppShell wide>
      <div className="md:min-h-[60vh] md:px-[4%]">
        <TopBar center title={section?.title || (loading ? "" : "View All")} />
        {body}
      </div>
    </AppShell>
  );
}
