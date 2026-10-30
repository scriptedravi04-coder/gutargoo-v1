// v3 Profile (notes 09): account card or guest card, Account + Help groups, one Sign out with a confirm sheet,
// clapperboard footer (tap ROLL v3.0 five times for the credits).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, CircleHelp, Crown, Download, Info, Instagram, ShieldCheck, Smartphone, Ticket, UserPen, Youtube } from "lucide-react";
import { api, errorMessage } from "@v/lib/api";
import { prettyMobile, useAuth } from "@v/lib/auth";
import { storage } from "@v/lib/storage";
import { InstallDialogs, useInstallAction } from "@v/components/InstallPrompt";
import { EASE, RED, Sheet, Shell, Spinner, TOP, useV3Toast } from "./ui";
import { AppSheet } from "./Detail";
import { setPro } from "./pro";
import { useFounder } from "./founder";

interface ProfileData {
  name?: string;
  isPremiusm?: boolean;
  subscriptionExpiry?: string | null;
}

export function useProfile() {
  const { isLoggedIn, token } = useAuth();
  return useQuery({
    queryKey: ["customer-profile", token],
    enabled: isLoggedIn,
    queryFn: async () => {
      const d = (await api.get<{ data?: ProfileData }>("/customer/profile")).data?.data || {};
      if (d.name) storage.setProfile({ ...storage.getProfile(), name: d.name });
      setPro(isPremium(d));
      return d;
    },
    staleTime: 60 * 1000,
  });
}

export const isPremium = (p?: ProfileData) => !!p && (!!p.isPremiusm || (!!p.subscriptionExpiry && new Date(p.subscriptionExpiry).getTime() > Date.now()));

type SheetKind = null | "edit" | "redeem" | "about" | "egg" | "signout" | "app";

export default function ProfileV3() {
  const { isLoggedIn, mobile, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useV3Toast();
  const profile = useProfile();
  const install = useInstallAction();
  const founder = useFounder();
  const offerOn = !!founder.data?.active && !founder.data.isFounder;
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [taps, setTaps] = useState<{ n: number; t: number }>({ n: 0, t: 0 });
  const name = (profile.data?.name || storage.getProfile().name || "").trim();
  const pro = isPremium(profile.data);
  const close = () => setSheet(null);

  const groups: { title: string; rows: { icon: typeof UserPen; label: string; hint?: string; go: () => void }[] }[] = [
    {
      title: "Account",
      rows: [
        { icon: UserPen, label: "Edit profile", go: () => (isLoggedIn ? setSheet("edit") : navigate("/login?next=/profile", { state: { back: true } })) },
        { icon: Crown, label: "Gutargoo+ Premium", hint: pro ? (founder.data?.isFounder ? "Founding Member" : "Active") : offerOn ? `Free · ${founder.data!.left} left` : "See plans", go: () => (pro && !founder.data?.isFounder ? toast("Premium is active on your number") : navigate("/plans")) },
        { icon: Ticket, label: "Redeem a code", go: () => (isLoggedIn ? setSheet("redeem") : navigate("/login?next=/profile", { state: { back: true } })) },
        { icon: Smartphone, label: "Get the app", hint: "Premium & downloads", go: () => setSheet("app") },
        ...(install.showButton ? [{ icon: Download, label: "Install the web app", hint: "This device", go: () => void install.run() }] : []),
      ],
    },
    {
      title: "Help",
      rows: [
        { icon: CircleHelp, label: "Help & FAQ", go: () => navigate("/help") },
        { icon: ShieldCheck, label: "Privacy policy", go: () => navigate("/privacy-policy") },
        { icon: Info, label: "About Gutargoo+", hint: "v3.0", go: () => setSheet("about") },
      ],
    },
  ];

  const tapRoll = () => {
    const now = Date.now();
    const n = now - taps.t < 1500 ? taps.n + 1 : 1;
    if (n >= 5) {
      setTaps({ n: 0, t: 0 });
      setSheet("egg");
    } else setTaps({ n, t: now });
  };

  return (
    <Shell nav ambient>
      <div style={{ padding: `${TOP(54)} 18px 110px`, animation: `gpIn .45s ${EASE} both` }}>
        <h1 style={{ margin: 0, font: "800 30px/1 Outfit,sans-serif", letterSpacing: -0.4 }}>Profile</h1>

        {isLoggedIn ? (
          <div className="glass" style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 20 }}>
            <div style={{ display: "flex", height: 58, width: 58, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 999, background: RED, font: "700 24px/1 Outfit,sans-serif" }}>{(name || "G")[0].toUpperCase()}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, font: "700 17px/1.2 Outfit,sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name || "Gutargoo+ viewer"}</p>
              <p style={{ margin: "4px 0 0", font: "400 13px/1 'DM Sans',sans-serif", color: "rgba(245,245,245,.65)" }}>{prettyMobile(mobile)}</p>
            </div>
            <button type="button" onClick={() => setSheet("edit")} style={{ whiteSpace: "nowrap", height: 36, padding: "0 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,.16)", background: "transparent", color: "#F5F5F5", font: "600 13px/1 'DM Sans',sans-serif" }}>
              Edit
            </button>
          </div>
        ) : (
          <div className="glass" style={{ marginTop: 18, padding: 18, borderRadius: 20 }}>
            <p style={{ margin: 0, font: "700 17px/1.3 Outfit,sans-serif" }}>Sign in to keep your place</p>
            <p style={{ margin: "6px 0 0", font: "400 13px/1.5 'DM Sans',sans-serif", color: "rgba(245,245,245,.68)" }}>Continue Watching and My List follow you across devices. No password — just an OTP. New here? Your account is created automatically.</p>
            <button type="button" onClick={() => navigate("/login?next=/profile", { state: { back: true } })} className="press" style={{ marginTop: 14, display: "flex", height: 48, width: "100%", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, border: 0, background: RED, color: "#fff", font: "700 15px/1 'DM Sans',sans-serif" }}>
              <Smartphone size={18} />
              Continue with mobile number
            </button>
          </div>
        )}

        {groups.map((g) => (
          <section key={g.title} style={{ marginTop: 24 }}>
            <h2 style={{ margin: "0 0 6px", padding: "0 4px", font: "600 12px/1 'DM Sans',sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(245,245,245,.6)" }}>{g.title}</h2>
            <div className="glass" style={{ borderRadius: 18, overflow: "hidden" }}>
              {g.rows.map((r, i) => (
                <button key={r.label} type="button" onClick={r.go} style={{ display: "flex", width: "100%", alignItems: "center", gap: 14, padding: "15px 16px", border: 0, borderBottom: i < g.rows.length - 1 ? "1px solid rgba(255,255,255,.05)" : 0, background: "transparent", color: "#F5F5F5", textAlign: "left" }}>
                  <span style={{ display: "flex", height: 34, width: 34, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 10, background: "rgba(255,255,255,.06)" }}>
                    <r.icon size={18} />
                  </span>
                  <span style={{ flexShrink: 0, font: "500 15px/1.2 'DM Sans',sans-serif", whiteSpace: "nowrap" }}>{r.label}</span>
                  <span style={{ flex: 1 }} />
                  {r.hint && <span style={{ flexShrink: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", font: "500 12px/1 'DM Sans',sans-serif", color: r.hint === "Active" || r.hint === "Founding Member" || r.hint?.startsWith("Free ·") ? "#F5B841" : "rgba(245,245,245,.55)" }}>{r.hint}</span>}
                  <span style={{ display: "flex", color: "rgba(245,245,245,.45)" }}>
                    <ChevronRight size={18} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}

        {isLoggedIn && (
          <button type="button" onClick={() => setSheet("signout")} className="press" style={{ marginTop: 24, height: 50, width: "100%", borderRadius: 16, border: "1px solid rgba(239,65,48,.45)", background: "transparent", color: "#FF6B5C", font: "700 15px/1 'DM Sans',sans-serif" }}>
            Sign out
          </button>
        )}

        {/* clapperboard footer */}
        <section style={{ margin: "36px auto 0", maxWidth: 250, opacity: 0.55 }}>
          <div style={{ height: 16, margin: "0 2px -1px", borderRadius: "8px 8px 0 0", background: "repeating-linear-gradient(-55deg,#F5F5F5 0 9px,#0a0a0a 9px 18px)", transform: "rotate(-5deg)", transformOrigin: "0 100%", boxShadow: "0 -1px 0 rgba(255,255,255,.2) inset" }} />
          <div style={{ height: 10, margin: "0 2px", background: "repeating-linear-gradient(55deg,#F5F5F5 0 9px,#0a0a0a 9px 18px)" }} />
          <div style={{ border: "1px solid rgba(255,255,255,.14)", borderTop: 0, borderRadius: "0 0 12px 12px", background: "#0c0c0c" }}>
            <Slate cells={[{ k: "Production", v: <>Gutargoo<span style={{ color: RED }}>+</span></>, span: 2 }, { k: "Roll", v: "v3.0", onClick: tapRoll }]} />
            <Slate cells={[{ k: "Scene", v: "Profile" }, { k: "Take", v: "Bas ek aur", span: 2 }]} />
            <Slate last cells={[{ k: "Director", v: "You" }, { k: "Crafted by", v: "Ybex Media", span: 2, href: "https://ybexmedia.in" }]} />
          </div>
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <a href="https://instagram.com/gutargooplus" target="_blank" rel="noreferrer" aria-label="Instagram" style={{ display: "flex", height: 36, width: 36, alignItems: "center", justifyContent: "center", borderRadius: 12, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.05)", color: "#F5F5F5" }}>
              <Instagram size={16} />
            </a>
            <a href="https://youtube.com/@gutargooplus" target="_blank" rel="noreferrer" aria-label="YouTube" style={{ display: "flex", height: 36, width: 36, alignItems: "center", justifyContent: "center", borderRadius: 12, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.05)", color: "#F5F5F5" }}>
              <Youtube size={16} />
            </a>
          </div>
        </section>
      </div>

      <EditSheet open={sheet === "edit"} onClose={close} name={name} />
      <RedeemV3 open={sheet === "redeem"} onClose={close} />
      <AppSheet open={sheet === "app"} onClose={close} heading="Get the Gutargoo+ app" text="Premium titles and downloads are in the app. Sign in there with the same number — your list and progress come along." />
      <Sheet open={sheet === "about"} onClose={close} label="About Gutargoo+">
        <h2 style={{ margin: 0, font: "800 22px/1.2 Outfit,sans-serif" }}>About Gutargoo+</h2>
        <div style={{ marginTop: 14, borderRadius: 16, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", overflow: "hidden" }}>
          <Row k="Version" v="3.0 (web)" />
          <Row k="Open-source licences" v="React, hls.js, Lucide" />
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", font: "500 14px/1 'DM Sans',sans-serif" }}>
            <span style={{ color: "rgba(245,245,245,.65)" }}>Design &amp; development</span>
            <a href="https://ybexmedia.in" target="_blank" rel="noreferrer" style={{ color: "#F5F5F5", textDecoration: "none" }}>
              Ybex Media
            </a>
          </div>
        </div>
        <p style={{ margin: "14px 0 0", textAlign: "center", font: "400 12px/1.5 'DM Sans',sans-serif", color: "rgba(245,245,245,.45)" }}>© {new Date().getFullYear()} Gutargoo+. All rights reserved.</p>
      </Sheet>
      <Sheet open={sheet === "egg"} onClose={close} label="Credits">
        <div style={{ textAlign: "center", padding: "6px 0 4px" }}>
          <p style={{ margin: 0, font: "800 30px/1 Outfit,sans-serif", letterSpacing: -0.6, color: "rgba(245,245,245,.9)" }}>
            #bas<span style={{ color: RED }}>ek</span>aur
            <br />
            episode
          </p>
          <p style={{ margin: "16px 0 0", font: "500 13px/1.5 'DM Sans',sans-serif", color: "rgba(245,245,245,.65)" }}>
            You found the credits.
            <br />
            Made with care by the team at{" "}
            <a href="https://ybexmedia.in" target="_blank" rel="noreferrer" style={{ color: "#F5F5F5", fontWeight: 700, textDecoration: "none" }}>
              Ybex Media
            </a>
            .
          </p>
          <button type="button" onClick={close} style={{ whiteSpace: "nowrap", marginTop: 18, height: 44, padding: "0 22px", borderRadius: 999, border: "1px solid rgba(255,255,255,.16)", background: "transparent", color: "#F5F5F5", font: "700 14px/1 'DM Sans',sans-serif" }}>
            Back to watching
          </button>
        </div>
      </Sheet>
      <Sheet open={sheet === "signout"} onClose={close} label="Sign out">
        <h2 style={{ margin: 0, font: "800 22px/1.2 Outfit,sans-serif" }}>Sign out?</h2>
        <p style={{ margin: "6px 0 0", font: "400 14px/1.5 'DM Sans',sans-serif", color: "rgba(245,245,245,.7)" }}>Your list and progress stay saved to {prettyMobile(mobile) || "your number"}.</p>
        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <button type="button" onClick={close} style={{ flex: 1, height: 50, borderRadius: 14, border: "1px solid rgba(255,255,255,.16)", background: "transparent", color: "#F5F5F5", font: "700 15px/1 'DM Sans',sans-serif" }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              logout();
              close();
              toast("Signed out");
            }}
            style={{ flex: 1, height: 50, borderRadius: 14, border: 0, background: RED, color: "#fff", font: "700 15px/1 'DM Sans',sans-serif" }}
          >
            Sign out
          </button>
        </div>
      </Sheet>
      <InstallDialogs action={install} />
    </Shell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,.06)", font: "500 14px/1.2 'DM Sans',sans-serif" }}>
      <span style={{ color: "rgba(245,245,245,.65)" }}>{k}</span>
      <span style={{ textAlign: "right" }}>{v}</span>
    </div>
  );
}

function Slate({ cells, last }: { cells: { k: string; v: React.ReactNode; span?: number; onClick?: () => void; href?: string }[]; last?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", borderBottom: last ? 0 : "1px solid rgba(255,255,255,.1)" }}>
      {cells.map((c, i) => {
        const inner = (
          <>
            <div style={{ font: "700 7.5px/1 'DM Sans',sans-serif", letterSpacing: ".16em", textTransform: "uppercase", color: "rgba(245,245,245,.45)" }}>{c.k}</div>
            <div style={{ marginTop: 4, font: "700 12px/1.15 Outfit,sans-serif", color: "#F5F5F5" }}>{c.v}</div>
          </>
        );
        const style = { padding: "8px 10px", gridColumn: c.span ? `span ${c.span}` : undefined, borderRight: i < cells.length - 1 ? "1px solid rgba(255,255,255,.1)" : 0, textDecoration: "none", userSelect: "none" as const };
        return c.href ? (
          <a key={c.k} href={c.href} target="_blank" rel="noreferrer" style={style}>
            {inner}
          </a>
        ) : (
          <div key={c.k} onClick={c.onClick} style={style}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

function EditSheet({ open, onClose, name }: { open: boolean; onClose: () => void; name: string }) {
  const [v, setV] = useState(name);
  const qc = useQueryClient();
  const toast = useV3Toast();
  const navigate = useNavigate();
  useEffect(() => {
    if (open) setV(name);
  }, [open, name]);
  const save = useMutation({
    mutationFn: async (n: string) => (await api.put("/customer/profile", { name: n })).data,
    onSuccess: (_d, n) => {
      storage.setProfile({ ...storage.getProfile(), name: n });
      qc.invalidateQueries({ queryKey: ["customer-profile"] });
      toast("Profile saved");
      onClose();
    },
    onError: (e) => toast(errorMessage(e)),
  });
  return (
    <Sheet open={open} onClose={onClose} label="Edit profile">
      <h2 style={{ margin: 0, font: "800 22px/1.2 Outfit,sans-serif" }}>Edit profile</h2>
      <label style={{ display: "block", marginTop: 16, font: "600 12px/1 'DM Sans',sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(245,245,245,.6)" }}>Your name</label>
      <input
        value={v}
        onChange={(e) => setV(e.target.value.slice(0, 60))}
        placeholder="Name"
        autoFocus
        style={{ marginTop: 8, width: "100%", height: 52, padding: "0 16px", borderRadius: 14, border: "1.5px solid rgba(255,255,255,.1)", outline: 0, background: "#000", color: "#F5F5F5", font: "600 16px/1 'DM Sans',sans-serif", boxShadow: "none" }}
      />
      <button type="button" disabled={save.isPending || !v.trim()} onClick={() => save.mutate(v.trim())} style={{ marginTop: 14, display: "flex", height: 50, width: "100%", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, border: 0, background: v.trim() ? RED : "#262626", color: "#fff", font: "700 15px/1 'DM Sans',sans-serif" }}>
        {save.isPending ? <Spinner size={18} /> : "Save"}
      </button>
      <button
        type="button"
        onClick={() => {
          onClose();
          navigate("/account");
        }}
        style={{ marginTop: 8, height: 40, width: "100%", border: 0, background: "transparent", color: "rgba(245,245,245,.6)", font: "600 13px/1 'DM Sans',sans-serif" }}
      >
        Account details & delete account
      </button>
    </Sheet>
  );
}

interface CodeRow {
  _id: string;
  code: string;
  description?: string;
  reward?: string;
  expiresAt?: string;
}

function RedeemV3({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { token } = useAuth();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["redeem-list", token],
    enabled: open,
    queryFn: async () => (await api.get<{ data: CodeRow[] }>("/redeem/list")).data.data || [],
  });
  useEffect(() => {
    if (open) setMsg(null);
  }, [open]);
  const apply = useMutation({
    mutationFn: async (c: string) => (await api.post<{ success?: boolean; message?: string }>("/redeem", { code: c })).data,
    onSuccess: (d) => {
      const ok = d?.success !== false;
      setMsg({ ok, text: ok ? `${d?.message || "Code applied"} — premium benefits work in the Gutargoo+ app on this number.` : d?.message || "Could not apply this code" });
      if (ok) {
        setCode("");
        qc.invalidateQueries({ queryKey: ["redeem-list"] });
        qc.invalidateQueries({ queryKey: ["customer-profile"] });
      }
    },
    onError: (e) => setMsg({ ok: false, text: errorMessage(e) }),
  });
  const fmt = (s?: string) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");
  return (
    <Sheet open={open} onClose={onClose} label="Redeem a code">
      <h2 style={{ margin: 0, font: "800 22px/1.2 Outfit,sans-serif" }}>Redeem a code</h2>
      <p style={{ margin: "6px 0 0", font: "400 13px/1.5 'DM Sans',sans-serif", color: "rgba(245,245,245,.7)" }}>Codes unlock premium benefits in the Gutargoo+ app on this number.</p>
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, "").slice(0, 32))}
          onKeyDown={(e) => e.key === "Enter" && code.trim() && apply.mutate(code.trim())}
          placeholder="ENTER CODE"
          aria-label="Code"
          style={{ flex: 1, minWidth: 0, height: 52, padding: "0 16px", borderRadius: 14, border: "1.5px solid rgba(255,255,255,.1)", outline: 0, background: "#000", color: "#F5F5F5", font: "700 15px/1 'DM Sans',sans-serif", letterSpacing: ".12em", boxShadow: "none" }}
        />
        <button type="button" disabled={apply.isPending} onClick={() => (code.trim() ? apply.mutate(code.trim()) : setMsg({ ok: false, text: "Enter a code first" }))} style={{ height: 52, padding: "0 20px", borderRadius: 14, border: 0, background: RED, color: "#fff", font: "700 14px/1 'DM Sans',sans-serif" }}>
          {apply.isPending ? <Spinner size={16} /> : "Apply"}
        </button>
      </div>
      {msg && <p style={{ margin: "10px 0 0", font: "500 13px/1.45 'DM Sans',sans-serif", color: msg.ok ? "#4ade80" : "#FF6B5C" }}>{msg.text}</p>}
      {(list.data || []).length > 0 && (
        <>
          <p style={{ margin: "18px 0 8px", font: "600 12px/1 'DM Sans',sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(245,245,245,.6)" }}>Available</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(list.data || []).slice(0, 6).map((c) => (
              <div key={c._id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, border: "1px dashed rgba(239,65,48,.5)", background: "rgba(239,65,48,.06)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, font: "700 15px/1 'DM Sans',sans-serif", letterSpacing: ".1em" }}>{c.code}</p>
                  <p style={{ margin: "5px 0 0", font: "400 12px/1.3 'DM Sans',sans-serif", color: "rgba(245,245,245,.65)" }}>{[c.description || c.reward, c.expiresAt ? `expires ${fmt(c.expiresAt)}` : ""].filter(Boolean).join(" · ")}</p>
                </div>
                <button type="button" onClick={() => setCode(c.code)} style={{ whiteSpace: "nowrap", height: 34, padding: "0 14px", borderRadius: 999, border: 0, background: "#F5F5F5", color: "#000", font: "700 12px/1 'DM Sans',sans-serif" }}>
                  Use
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}
