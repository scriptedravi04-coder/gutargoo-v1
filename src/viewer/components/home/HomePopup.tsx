import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { api, ApiPopup } from "@v/lib/api";
import { useSplashDone } from "./splashState";

const seenKey = (id: string) => `gp-popup-seen-${id}`;
const wasSeen = (id: string) => {
  try {
    return sessionStorage.getItem(seenKey(id)) === "1";
  } catch {
    return false;
  }
};
const markSeen = (id: string) => {
  try {
    sessionStorage.setItem(seenKey(id), "1");
  } catch {
    /* ignore */
  }
};

// Admin's announcement image, shown once per session after the splash.
export function HomePopup() {
  const splashDone = useSplashDone();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: popup } = useQuery({
    queryKey: ["popup"],
    queryFn: async () => (await api.get<{ data: ApiPopup | null }>("/popups")).data?.data || null,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });

  useEffect(() => {
    if (!splashDone || !popup || !popup.image || popup.isActive === false || wasSeen(popup._id)) return;
    // only open once the image is ready, so the card never pops in empty
    const img = new Image();
    let alive = true;
    img.onload = () => {
      if (!alive) return;
      markSeen(popup._id);
      setOpen(true);
    };
    img.src = popup.image;
    return () => {
      alive = false;
    };
  }, [splashDone, popup]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || !popup) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/[.82] backdrop-blur-[2px]" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={popup.title || "Announcement"}
        onClick={(e) => e.stopPropagation()}
        className="animate-pop relative aspect-[2/3]"
        style={{ width: "min(360px, calc(100vw - 48px), 56vh)" }}
      >
        {(() => {
          const img = (
            <img
              src={popup.image}
              alt={popup.title || "Announcement"}
              className="h-full w-full rounded-[20px] border-[1.5px] border-amber-400/55 object-cover"
            />
          );
          const link = (popup.link || "").trim();
          if (!link) return img;
          // admin can link the popup to a page of this site (/movie/…) or any website
          return link.startsWith("/") ? (
            <button type="button" className="block h-full w-full" onClick={() => (setOpen(false), navigate(link))}>
              {img}
            </button>
          ) : /^https?:\/\//i.test(link) ? (
            <a href={link} target="_blank" rel="noreferrer" className="block h-full w-full" onClick={() => setOpen(false)}>
              {img}
            </a>
          ) : (
            img
          );
        })()}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full border border-amber-400 bg-black/60 shadow-[0_0_10px_rgba(251,191,36,.6)] hover:bg-black/80"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
