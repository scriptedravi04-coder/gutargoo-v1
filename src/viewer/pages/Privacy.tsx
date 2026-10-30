import { AppShell } from "@v/components/AppShell";
import { TopBar } from "@v/components/TopBar";
import { InfoCard } from "@v/components/profile/InfoCard";

// Public page (linked from the app stores): works without login. Text is verbatim from the app.
const SECTIONS = [
  {
    t: "1. Information We Collect",
    b: "We collect information you provide directly, such as when you create an account or contact us. This includes name, email, and viewing preferences.",
  },
  {
    t: "2. How We Use Your Information",
    b: "We use your information to provide, maintain, and improve our services, send communications, and comply with legal obligations.",
  },
  {
    t: "3. Data Security",
    b: "We implement industry-standard security measures to protect your personal information. All data is encrypted during transmission and stored securely.",
  },
  {
    t: "4. Sharing Your Information",
    b: "We do not sell your personal information. We may share data with trusted service providers under strict confidentiality.",
  },
  {
    t: "5. Cookies and Tracking",
    b: "We use cookies and similar technologies to enhance your experience and analyze usage patterns.",
  },
  {
    t: "6. Your Rights",
    b: "You can access, update, or delete your personal information anytime by contacting support@Gutargooplus.com.",
  },
  {
    t: "7. iOS Subscription & Payment",
    b: "Gutargoo+ does not offer paid subscriptions on iOS. All content is free.",
  },
  {
    t: "8. Contact Us",
    b: "For support, contact us at Support@Gutargooplus.com",
  },
];

export default function Privacy() {
  return (
    <AppShell nav={false} bg="bg-[#0A0A0A]">
      <div>
        <TopBar title="Privacy Policy" className="bg-[#0A0A0A]/95" />
        <div className="space-y-3 px-4 pb-8 pt-2 desk:px-0">
          {SECTIONS.map((s) => (
            <InfoCard key={s.t} title={s.t}>
              {s.b}
            </InfoCard>
          ))}
          <p className="pt-4 text-center text-xs text-[#6B6B6B]">Last Updated: January 2026</p>
        </div>
      </div>
    </AppShell>
  );
}
