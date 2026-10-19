import { useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, CircleHelp, Download, Gift, ShieldCheck, Smartphone, User } from "lucide-react";
import { AppShell } from "@v/components/AppShell";
import { TopBar } from "@v/components/TopBar";
import { SettingsRow, SettingsSection } from "@v/components/profile/SettingsRow";
import { SignOutDialog } from "@v/components/profile/SignOutDialog";
import { RedeemSheet } from "@v/components/profile/RedeemSheet";
import { useAuth, prettyMobile } from "@v/lib/auth";
import { useToast } from "@v/hooks/useToast";
import { storage } from "@v/lib/storage";
import { APP_STORE_URL, PLAY_STORE_URL } from "@v/lib/config";
import { InstallDialogs, useInstallAction } from "@v/components/InstallPrompt";

export default function Profile() {
  const { isLoggedIn, mobile, logout } = useAuth();
  const toast = useToast();
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const name = storage.getProfile().name;
  const install = useInstallAction();

  return (
    <AppShell>
      <TopBar title="Profile" back={false} />

      <div className="px-4 pb-8 desk:px-0">
        {/* login state */}
        {isLoggedIn ? (
          <div className="mt-2 flex items-center gap-4 rounded-2xl border border-white/10 bg-[#1A1A1A] p-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#F97316] to-[#EF4444] text-xl font-bold">
              {name ? name.trim().charAt(0).toUpperCase() : <User className="h-7 w-7" />}
            </div>
            <div className="min-w-0 flex-1">
              {name && <p className="truncate text-[15px] font-semibold">{name}</p>}
              <p className={name ? "text-sm text-white/60" : "text-[15px] font-semibold"}>{prettyMobile(mobile) || "Signed in"}</p>
            </div>
            <button type="button" onClick={() => setConfirmOut(true)} className="h-10 shrink-0 rounded-lg border border-red-500/50 bg-red-500/[.08] px-3 text-sm font-semibold text-red-400">
              Sign out
            </button>
          </div>
        ) : (
          <div className="mt-2 rounded-2xl border border-white/10 bg-[#1A1A1A] p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/10">
                <User className="h-7 w-7 text-white/80" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">You are browsing as Guest</p>
                <p className="mt-0.5 text-[13px] leading-snug text-white/60">Login to sync Continue Watching and redeem codes.</p>
              </div>
            </div>
            <Link
              to="/login?next=/profile"
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange text-[15px] font-bold text-white active:opacity-90"
            >
              <Smartphone className="h-5 w-5" />
              Login / Sign up with mobile number
            </Link>
            <p className="mt-2 text-center text-xs text-white/50">We'll send an OTP. New here? Your account is created automatically.</p>
          </div>
        )}

        <SettingsSection title="APP SETTINGS">
          <SettingsRow icon={User} label="My Account" to="/account" />
          <SettingsRow icon={Bookmark} label="My List" to="/watchlist" />
          <SettingsRow icon={Gift} label="Redeem Code" onClick={() => setRedeemOpen(true)} />
        </SettingsSection>

        <SettingsSection title="SUPPORT">
          <SettingsRow icon={CircleHelp} label="Help & FAQ" to="/help" />
          <SettingsRow icon={ShieldCheck} label="Privacy Policy" to="/privacy-policy" />
        </SettingsSection>

        <SettingsSection title="GET THE APP">
          {install.showButton && <SettingsRow icon={Download} label="Install Gutargoo+ on this device" onClick={install.run} />}
          <SettingsRow icon={Smartphone} label="Get it on Google Play" href={PLAY_STORE_URL} />
          {APP_STORE_URL && <SettingsRow icon={Smartphone} label="Download on the App Store" href={APP_STORE_URL} />}
        </SettingsSection>

        <p className="mt-10 text-center text-sm text-[#9E9E9E]">Version: 1.0.0 (web)</p>
      </div>

      <InstallDialogs action={install} />
      <RedeemSheet open={redeemOpen} onClose={() => setRedeemOpen(false)} />
      <SignOutDialog
        open={confirmOut}
        onCancel={() => setConfirmOut(false)}
        onConfirm={() => {
          setConfirmOut(false);
          logout();
          toast("Signed out");
        }}
      />
    </AppShell>
  );
}
