import { Link } from "react-router-dom";
import { AppShell } from "@v/components/AppShell";

export default function NotFound() {
  return (
    <AppShell nav={false}>
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-8 text-center">
        <img src="/img/mark.png" alt="" className="h-16 w-16 object-contain opacity-80" />
        <p className="text-6xl font-extrabold text-white/90">404</p>
        <p className="text-base font-semibold">Page not found</p>
        <p className="text-sm text-white/60">The page you are looking for doesn’t exist or has moved.</p>
        <Link to="/" replace className="mt-4 rounded-xl bg-orange px-8 py-3 text-sm font-bold">
          Go Home
        </Link>
      </div>
    </AppShell>
  );
}
