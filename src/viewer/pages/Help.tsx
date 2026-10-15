import { Mail } from "lucide-react";
import { AppShell } from "@v/components/AppShell";
import { TopBar } from "@v/components/TopBar";
import { FaqCard, infoCardClass } from "@v/components/profile/InfoCard";
import { SUPPORT_EMAIL } from "@v/lib/config";

// Same questions as the app (lib/profile/screen/help_faq.dart), answers written for the website
const FAQ = [
  {
    q: "What type of content is available on Gutargoo+?",
    a: "Gutargoo+ offers self-produced movies as well as officially licensed movies available for streaming.",
  },
  {
    q: "What should I do if I don’t receive the OTP?",
    a: "Please check your network connection and try the “Resend OTP” option. If the issue continues, try again after some time.",
  },
  {
    q: "How do I contact customer support?",
    a: "You can reach our support team via email at support@Gutargooplus.com.",
  },
  {
    q: "How can I use Gutargoo+?",
    a: "On this website just pick any free movie or series and press Play — no sign-in needed. Sign in with your mobile number (OTP) to keep Continue Watching and redeem codes. You can also install the website from the menu (Install) or get the mobile app.",
  },
  {
    q: "Can I watch on my TV or laptop?",
    a: "Yes. Open the website in your TV's or laptop's browser. Use the arrow keys / TV remote to move, OK to open and Back to go back. The full-screen button in the top menu gives a TV-style view.",
  },
  {
    q: "Can I download movies?",
    a: "Downloads for offline watching are available in the Gutargoo+ mobile app. On the website you can stream all free titles.",
  },
  {
    q: "How can I improve video quality?",
    a: "While a video plays, open Settings (gear icon) → Quality and choose a quality. On iPhone/iPad the quality changes automatically with your connection.",
  },
];

export default function Help() {
  return (
    <AppShell nav={false}>
      <div className="min-h-screen bg-[#0A0A0A] md:min-h-0 md:bg-transparent">
        <div className="[&>header]:bg-[#0A0A0A]/95">
          <TopBar title="Help & FAQ" />
        </div>
        <div className="space-y-3 px-4 pb-10 pt-2">
          {FAQ.map((f) => (
            <FaqCard key={f.q} question={f.q} answer={f.a} />
          ))}
          <a href={`mailto:${SUPPORT_EMAIL}`} className={`${infoCardClass} mt-6 flex items-center gap-3 p-4`}>
            <Mail className="h-5 w-5 shrink-0 text-[#E50914]" />
            <span className="text-[13px] text-[#B5B5B5]">
              Still need help? Write to us at <span className="font-semibold text-[#F2F2F2]">{SUPPORT_EMAIL}</span>
            </span>
          </a>
        </div>
      </div>
    </AppShell>
  );
}
