import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value?: number | string;
  icon: ReactNode;
  /** small line under the number, e.g. "12 published" */
  hint?: ReactNode;
  /** optional page to open when the card is clicked */
  to?: string;
  loading?: boolean;
}

const fmt = (v?: number | string) => (typeof v === "number" ? v.toLocaleString("en-IN") : v ?? "–");

export function StatCard({ title, value, icon, hint, to, loading }: StatCardProps) {
  const body = (
    <Card className={cn("h-full transition-colors", to && "hover:border-primary/50")}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? <Skeleton className="h-8 w-20" /> : <p className="text-2xl font-bold tracking-tight">{fmt(value)}</p>}
            {hint && !loading && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className="shrink-0 rounded-lg bg-primary/10 p-2.5 text-primary [&_svg]:h-5 [&_svg]:w-5">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
  return to ? (
    <Link to={to} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
