import { Link } from "react-router-dom";
import { APP_STORE_URL, PLAY_STORE_URL, SUPPORT_EMAIL } from "@v/lib/config";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-white/10 px-[4%] pb-10 pt-10 text-sm text-white/55">
      <div className="flex flex-wrap items-start justify-between gap-8">
        <div className="max-w-sm">
          <img src="/img/white_logo.png" alt="Gutargoo+" className="h-7 w-auto" />
          <p className="mt-3 leading-relaxed">Watch Gutargoo+ originals, movies and web series for free — on your phone, laptop or TV.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2">
          <Link to="/" className="hover:text-white">Home</Link>
          <Link to="/search" className="hover:text-white">Search</Link>
          <Link to="/watchlist" className="hover:text-white">My List</Link>
          <Link to="/profile" className="hover:text-white">Account</Link>
          <Link to="/help" className="hover:text-white">Help &amp; FAQ</Link>
          <Link to="/privacy-policy" className="hover:text-white">Privacy Policy</Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-white">Contact us</a>
        </nav>
        <div className="flex flex-col gap-2">
          <p className="font-semibold text-white/80">Get the app</p>
          <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer" className="rounded-lg border border-white/20 px-4 py-2 font-semibold text-white hover:bg-white/10">
            Get it on Google Play
          </a>
          {APP_STORE_URL && (
            <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="rounded-lg border border-white/20 px-4 py-2 font-semibold text-white hover:bg-white/10">
              Download on the App Store
            </a>
          )}
        </div>
      </div>
      <p className="mt-10 text-xs text-white/35">© {new Date().getFullYear()} Gutargoo+. All rights reserved.</p>
    </footer>
  );
}
