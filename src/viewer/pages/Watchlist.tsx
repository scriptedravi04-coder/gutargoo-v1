import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { AppShell } from "@v/components/AppShell";
import { Img } from "@v/components/Img";
import { useWatchlist } from "@v/hooks/useWatchlist";
import { useToast } from "@v/hooks/useToast";
import { detailPath } from "@v/lib/content";

// Favorite tab: "My Favorites" (saved on this device)
export default function Watchlist() {
  const { list, remove } = useWatchlist();
  const toast = useToast();

  return (
    <AppShell wide>
      <div className="min-h-screen bg-bg md:min-h-[60vh] md:bg-transparent md:px-[4%]">
        <header className="sticky top-0 z-30 flex h-14 items-center bg-bg/95 px-4 backdrop-blur md:static md:h-auto md:bg-transparent md:px-0 md:pb-6 md:pt-8">
          <h1 className="text-lg font-bold md:text-[1.75rem]">My List</h1>
        </header>

        {list.length === 0 ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-8 text-center">
            <Heart className="h-12 w-12 text-white/25" />
            <p className="text-base font-semibold text-white/80">Your list is empty</p>
            <p className="text-sm text-white/50">Tap “My List” on any movie or series to keep it here. Your list is saved on this device.</p>
            <Link to="/" className="mt-2 rounded-xl bg-orange px-6 py-2.5 text-sm font-bold">
              Browse Home
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 px-4 pb-6 pt-2 md:grid-cols-4 md:gap-x-5 md:gap-y-7 md:px-0 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {list.map((it) => (
              <div key={it.id} className="relative">
                <Link to={detailPath(it)} aria-label={it.title} className="gp-card block rounded-md">
                  <Img src={it.poster} alt={it.title} className="aspect-[.8] rounded-md md:aspect-[2/3]" />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    remove(it.id);
                    toast("Removed from My List");
                  }}
                  aria-label={`Remove ${it.title} from My List`}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/[.54]"
                >
                  <Heart className="h-4 w-4 text-red-500" fill="currentColor" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
