import { cn } from "@/lib/utils";

const TONES = {
  ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  wait: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  bad: "bg-red-500/10 text-red-700 dark:text-red-400",
  none: "bg-muted text-muted-foreground",
};

export function StatusPill({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONES[tone])}>{children}</span>;
}
