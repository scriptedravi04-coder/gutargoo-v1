// "Cast & Crew" — round photos (initials when there's no photo), name and role.
import { useState } from "react";
import type { Person } from "@v/lib/content";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

function Avatar({ p }: { p: Person }) {
  const [failed, setFailed] = useState(false);
  if (p.image && !failed) {
    return <img src={p.image} alt={p.name} loading="lazy" onError={() => setFailed(true)} className="h-[60px] w-[60px] rounded-full bg-[#212121] object-cover" />;
  }
  return (
    <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[#212121] text-base font-bold text-white/70" aria-hidden="true">
      {initials(p.name)}
    </div>
  );
}

export function CastRow({ people }: { people: Person[] }) {
  if (!people.length) return null;
  return (
    <section className="pt-5">
      <h2 className="px-4 text-sm font-bold">Cast &amp; Crew</h2>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 py-3">
        {people.map((p, i) => (
          <div key={`${p.name}-${i}`} className="flex w-[70px] shrink-0 flex-col items-center text-center">
            <Avatar p={p} />
            <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-tight">{p.name}</p>
            {p.role && <p className="mt-0.5 line-clamp-1 text-[9px] text-[#9E9E9E]">{p.role}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
