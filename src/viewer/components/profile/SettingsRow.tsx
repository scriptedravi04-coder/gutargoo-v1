import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, LucideIcon } from "lucide-react";

// One ListTile-style row: white icon, white text, small chevron
export function SettingsRow({
  icon: Icon,
  label,
  to,
  href,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  to?: string;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <Icon className="h-6 w-6 shrink-0 text-white" />
      <span className="flex-1 text-left text-[15px] text-white">{label}</span>
      <ChevronRight className="h-4 w-4 text-white/70" />
    </>
  );
  const cls = "flex w-full items-center gap-4 rounded-lg px-2 py-3.5 hover:bg-white/5 active:bg-white/10";
  if (to)
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    );
  if (href)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {inner}
      </a>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-1 px-2 text-[13px] font-semibold tracking-wide text-[#9E9E9E]">{title}</h2>
      {children}
    </section>
  );
}
