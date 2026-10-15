import { useEscape } from "@v/hooks/useEscape";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, X } from "lucide-react";
import clsx from "clsx";
import { api, errorMessage } from "@v/lib/api";
import { useAuth } from "@v/lib/auth";
import { Spinner } from "@v/components/States";

interface RedeemCodeRow {
  _id: string;
  code: string;
  description?: string;
  reward?: string;
  isUsed?: boolean;
  expiresAt?: string;
}

const fmtDate = (s?: string) => {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

// Bottom sheet: redeem a code, or pick one from the list the server offers
export function RedeemSheet({ open, onClose, next = "/profile" }: { open: boolean; onClose: () => void; next?: string }) {
  useEscape(open, onClose);
  const { isLoggedIn, token } = useAuth();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [showList, setShowList] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const list = useQuery({
    queryKey: ["redeem-list", token],
    queryFn: async () => (await api.get<{ data: RedeemCodeRow[] }>("/redeem/list")).data.data || [],
    enabled: open && isLoggedIn && showList,
  });

  const redeem = useMutation({
    mutationFn: async (c: string) => (await api.post<{ success?: boolean; message?: string }>("/redeem", { code: c })).data,
    onSuccess: (d) => {
      const ok = d?.success !== false;
      const base = d?.message || (ok ? "Code applied" : "Could not apply this code");
      // web plays free titles only — premium benefits are used in the mobile app
      setResult({ ok, text: ok ? `${base}. Premium benefits work in the Gutargoo+ mobile app (same number).` : base });
      if (ok) {
        setCode("");
        qc.invalidateQueries({ queryKey: ["redeem-list"] });
      }
    },
    onError: (e) => setResult({ ok: false, text: errorMessage(e) }),
  });

  if (!open) return null;

  const submit = () => {
    const c = code.trim();
    if (!c) return setResult({ ok: false, text: "Please enter a code" });
    setResult(null);
    redeem.mutate(c);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="redeem-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-pop max-h-[85vh] w-full max-w-app overflow-y-auto rounded-t-3xl bg-[#1A1A1A] p-5 pb-10 md:max-w-lg md:rounded-3xl md:pb-6"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-orange" />
          <h2 id="redeem-title" className="flex-1 text-lg font-bold">
            Redeem Code
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-white/70 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!isLoggedIn ? (
          <div className="mt-6 text-center">
            <p className="text-sm text-white/70">Please sign in to redeem a code.</p>
            <Link
              to={`/login?next=${encodeURIComponent(next)}`}
              className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-orange px-8 text-sm font-bold"
            >
              Sign in
            </Link>
          </div>
        ) : (
          <>
            <form
              className="mt-5 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Enter your code"
                aria-label="Redeem code"
                autoCapitalize="characters"
                className="h-12 min-w-0 flex-1 rounded-xl border border-white/[.12] bg-[#0E0E0E] px-4 text-[15px] tracking-wider text-white outline-none placeholder:text-[#8E8E8E] placeholder:tracking-normal focus:border-orange"
              />
              <button type="submit" disabled={redeem.isPending} className="h-12 rounded-xl bg-orange px-5 text-sm font-bold disabled:opacity-60">
                {redeem.isPending ? "..." : "Redeem"}
              </button>
            </form>
            {result && <p className={clsx("mt-3 text-sm", result.ok ? "text-green-400" : "text-red-400")}>{result.text}</p>}

            <button type="button" onClick={() => setShowList((s) => !s)} className="mt-5 text-sm font-semibold text-orange">
              {showList ? "Hide Available Codes" : "View Available Codes"}
            </button>

            {showList && (
              <div className="mt-3 space-y-2">
                {list.isLoading && (
                  <div className="flex justify-center py-6">
                    <Spinner />
                  </div>
                )}
                {list.error && (
                  <div className="flex items-center justify-between rounded-xl bg-white/5 p-3 text-sm text-white/70">
                    <span>{errorMessage(list.error, "Couldn't load codes.")}</span>
                    <button type="button" onClick={() => list.refetch()} className="font-semibold text-orange">
                      Retry
                    </button>
                  </div>
                )}
                {list.data && list.data.length === 0 && <p className="py-4 text-center text-sm text-white/50">No codes available right now.</p>}
                {list.data?.map((c) => (
                  <div key={c._id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[15px] font-bold tracking-wider">{c.code}</p>
                      {(c.description || c.reward) && <p className="mt-0.5 text-xs text-white/70">{c.description || c.reward}</p>}
                      {c.expiresAt && <p className="mt-0.5 text-[11px] text-white/40">Expires {fmtDate(c.expiresAt)}</p>}
                    </div>
                    {c.isUsed ? (
                      <span className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/50">Used</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setCode(c.code);
                          setResult(null);
                        }}
                        className="rounded-lg border border-orange px-3 py-1.5 text-xs font-bold text-orange hover:bg-orange/10"
                      >
                        Use
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
