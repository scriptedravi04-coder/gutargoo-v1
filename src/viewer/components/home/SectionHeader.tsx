import { Link } from "react-router-dom";

// "TRENDING NOW ........ View All"
export function SectionHeader({ title, viewAllTo }: { title: string; viewAllTo?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-[5px]">
      <h2 className="truncate text-base font-bold uppercase text-white">{title}</h2>
      {viewAllTo && (
        <Link to={viewAllTo} className="-my-2 shrink-0 py-2 pl-3 text-sm text-orange hover:underline">
          View All
        </Link>
      )}
    </div>
  );
}
