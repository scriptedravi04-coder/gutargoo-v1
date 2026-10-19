import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pager({ page, totalPages, total, onPage }: { page: number; totalPages: number; total?: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return total !== undefined ? <p className="text-xs text-muted-foreground mt-3">{total} total</p> : null;
  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
        {total !== undefined && ` · ${total} total`}
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
