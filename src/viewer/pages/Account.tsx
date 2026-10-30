import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User } from "lucide-react";
import { AppShell } from "@v/components/AppShell";
import { TopBar } from "@v/components/TopBar";
import { SignOutDialog } from "@v/components/profile/SignOutDialog";
import { useAuth, prettyMobile } from "@v/lib/auth";
import { useToast } from "@v/hooks/useToast";
import { storage } from "@v/lib/storage";
import { api, errorMessage } from "@v/lib/api";
import { useEscape } from "@v/hooks/useEscape";

const fieldCls =
  "h-12 w-full rounded-xl border border-white/10 bg-[#1E1E1E] px-4 text-[15px] text-white outline-none placeholder:text-[#8E8E8E] focus:border-orange";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-white/60">{label}</span>
      {children}
    </label>
  );
}

// "My Account" → Edit Profile (name/email/age kept on this device; name also sent to the server)
export default function Account() {
  const { isLoggedIn, mobile, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const initial = storage.getProfile();
  const [name, setName] = useState(initial.name || "");
  const [email, setEmail] = useState(initial.email || "");
  const [age, setAge] = useState(initial.age || "");
  const [confirmOut, setConfirmOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameTouched = useRef(false);
  const closeDelete = useCallback(() => setConfirmDelete(false), []);
  useEscape(confirmDelete, closeDelete);

  // name comes from the server (same account as the app)
  useEffect(() => {
    if (!isLoggedIn) return;
    let alive = true;
    api
      .get<{ data?: { name?: string } }>("/customer/profile")
      .then((r) => {
        const n = r.data?.data?.name?.trim();
        // the account's name on the server wins over an older one saved on this device
        if (alive && n) {
          if (!nameTouched.current) setName(n);
          storage.setProfile({ ...storage.getProfile(), name: n });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [isLoggedIn]);

  const save = async () => {
    if (!isLoggedIn) return toast("Please login to edit your profile");
    const p = { name: name.trim(), email: email.trim(), age: age.trim() };
    if (p.email && !/^\S+@\S+\.\S+$/.test(p.email)) return toast("Please enter a valid email");
    setSaving(true);
    try {
      await api.put("/customer/profile", { name: p.name });
      storage.setProfile(p);
      toast("Saved");
    } catch (e) {
      toast(errorMessage(e, "Couldn't save. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    try {
      await api.delete("/customer/profile");
      logout();
      toast("Your account has been deleted");
      navigate("/", { replace: true });
    } catch (e) {
      toast(errorMessage(e, "Couldn't delete the account. Please try again."));
    }
  };

  const letter = name.trim().charAt(0).toUpperCase();

  return (
    <AppShell nav={false} bg="bg-[#121212]">
      <div>
        <TopBar
            className="bg-[#121212]/95"
            title="Edit Profile"
            right={
              isLoggedIn ? (
                <button type="button" onClick={() => void save()} disabled={saving} className="flex h-11 items-center px-3 text-[15px] font-bold text-orange disabled:opacity-50">
                  {saving ? "Saving…" : "Save"}
                </button>
              ) : null
            }
          />

        <div className="px-4 pb-8 desk:px-0">
          <div className="mx-auto mt-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#F97316] to-[#EF4444] text-4xl font-bold">
            {letter || <User className="h-11 w-11" />}
          </div>

          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Field label="Phone">
              <input value={isLoggedIn ? prettyMobile(mobile) || "Signed in" : "You are Guest"} readOnly className={`${fieldCls} text-white/70`} aria-readonly="true" />
            </Field>
            <Field label="Name">
              <input value={name} onChange={(e) => {
                  nameTouched.current = true;
                  setName(e.target.value.slice(0, 80));
                }} placeholder="Your name" autoComplete="name" disabled={!isLoggedIn} className={`${fieldCls} disabled:opacity-50`} />
            </Field>
            {!isLoggedIn && <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-white/70">Login with your mobile number (OTP) to edit your profile.</p>}
            <Field label="Email (saved on this device)">
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" autoComplete="email" disabled={!isLoggedIn} className={`${fieldCls} disabled:opacity-50`} />
            </Field>
            <Field label="Age (saved on this device)">
              <input
                value={age}
                onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="Your age"
                inputMode="numeric"
                disabled={!isLoggedIn}
                className={`${fieldCls} disabled:opacity-50`}
              />
            </Field>
            <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
          </form>

          <div className="mt-10">
            {isLoggedIn ? (
              <button
                type="button"
                onClick={() => setConfirmOut(true)}
                className="h-12 w-full rounded-xl border border-red-500/50 bg-red-500/[.08] text-[15px] font-bold text-red-500"
              >
                Sign Out
              </button>
            ) : null}
            {isLoggedIn ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="mt-6 w-full text-center text-sm font-semibold text-white/45 underline underline-offset-2 hover:text-red-400"
              >
                Delete my account
              </button>
            ) : (
              <Link to="/login?next=/account" className="flex h-12 w-full items-center justify-center rounded-xl bg-green-600 text-[15px] font-bold text-white">
                Login / Sign up
              </Link>
            )}
          </div>
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-6" onClick={() => setConfirmDelete(false)}>
          <div role="alertdialog" aria-modal="true" aria-label="Delete account" onClick={(e) => e.stopPropagation()} className="animate-pop w-full max-w-[360px] rounded-2xl bg-tile p-5">
            <h3 className="text-base font-bold">Delete your account?</h3>
            <p className="mt-2 text-sm text-white/60">Your Gutargoo+ account will be deleted and you'll be signed out on this device. This can't be undone.</p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setConfirmDelete(false)} className="flex-1 rounded-lg border border-white/25 py-2.5 text-sm font-semibold hover:bg-white/5">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(false);
                  void deleteAccount();
                }}
                className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      <SignOutDialog
        open={confirmOut}
        onCancel={() => setConfirmOut(false)}
        onConfirm={() => {
          setConfirmOut(false);
          logout();
          toast("Signed out");
          navigate("/profile", { replace: true });
        }}
      />
    </AppShell>
  );
}
