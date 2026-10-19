import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";

// Help & FAQ / Privacy Policy card styling from the app
export const infoCardClass =
  "rounded-[14px] border border-[rgba(155,8,8,.35)] bg-gradient-to-br from-[#0F0F0F] to-[#1A0A0A] shadow-[0_6px_14px_rgba(155,8,8,.2)]";

export function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={clsx(infoCardClass, "p-4")}>
      <h2 className="text-[14px] font-semibold text-[#F2F2F2]">{title}</h2>
      <div className="mt-2 text-[13px] leading-relaxed text-[#B5B5B5]">{children}</div>
    </section>
  );
}

export function FaqCard({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={infoCardClass}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="flex-1 text-[14px] font-semibold text-[#F2F2F2]">{question}</span>
        <ChevronDown className={clsx("h-5 w-5 shrink-0 text-[#E50914] transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && <p className="px-4 pb-4 text-[13px] leading-relaxed text-[#B5B5B5]">{answer}</p>}
    </div>
  );
}
