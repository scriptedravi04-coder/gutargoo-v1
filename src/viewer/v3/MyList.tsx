// v3 My List (notes 07): 3-column grid, bookmark removes with Undo, empty state, synced for signed-in users.
import { useNavigate } from "react-router-dom";
import { BookmarkCheck, BookmarkPlus } from "lucide-react";
import { useWatchlist } from "@v/hooks/useWatchlist";
import { useCatalog } from "@v/hooks/useCatalog";
import { useAuth } from "@v/lib/auth";
import type { Item } from "@v/lib/content";
import { EASE, kindGenre, kindLabel, Pic, RED, Shell, TOP, useOpenDetail, useV3Toast } from "./ui";

export default function MyListV3() {
  const { list, restore, remove } = useWatchlist();
  const { byId } = useCatalog();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const toast = useV3Toast();
  const openDetail = useOpenDetail();
  const n = list.length;
  const label = n ? `${n} title${n > 1 ? "s" : ""} · ${isLoggedIn ? "synced to your account" : "saved on this device"}` : "Nothing saved yet";

  return (
    <Shell nav ambient>
      <div style={{ padding: `${TOP(54)} 18px 110px`, animation: `gpIn .45s ${EASE} both` }}>
        <h1 style={{ margin: 0, font: "800 30px/1 Outfit,sans-serif", letterSpacing: -0.4 }}>My List</h1>
        <p style={{ margin: "8px 0 0", font: "500 13px/1.4 'DM Sans',sans-serif", color: "rgba(245,245,245,.62)" }}>{label}</p>
        {!isLoggedIn && n > 0 && (
          <button type="button" onClick={() => navigate("/login?next=/watchlist", { state: { back: true } })} style={{ marginTop: 6, border: 0, background: "transparent", padding: 0, color: "#F5F5F5", font: "700 13px/1.4 'DM Sans',sans-serif", textDecoration: "underline", textUnderlineOffset: 3 }}>
            Sign in to keep it on every device
          </button>
        )}
        {n === 0 ? (
          <div style={{ display: "flex", minHeight: "60vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center", animation: "gpFade .4s both" }}>
            <div className="glass" style={{ display: "flex", height: 72, width: 72, alignItems: "center", justifyContent: "center", borderRadius: 24, color: RED }}>
              <BookmarkPlus size={30} />
            </div>
            <p style={{ margin: "8px 0 0", font: "700 18px/1.3 Outfit,sans-serif" }}>Save titles for later</p>
            <p style={{ margin: 0, maxWidth: 270, font: "400 14px/1.5 'DM Sans',sans-serif", color: "rgba(245,245,245,.68)" }}>Tap the bookmark on any movie or series and it shows up here.</p>
            <button type="button" onClick={() => navigate("/")} style={{ whiteSpace: "nowrap", marginTop: 12, height: 46, padding: "0 24px", borderRadius: 999, border: 0, background: RED, color: "#fff", font: "700 14px/1 'DM Sans',sans-serif" }}>
              Find something to watch
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "14px 10px" }}>
            {list.map((e, i) => {
              const full = byId.get(e.id);
              const it = (full || { id: e.id, kind: e.kind, title: e.title, poster: e.poster, genres: [] }) as Item;
              return (
                <div key={e.id} style={{ position: "relative", animation: `gpRise .4s ${Math.min(i, 12) * 0.04}s both` }}>
                  <div className="press" onClick={() => openDetail(it)} role="link" tabIndex={0} style={{ position: "relative", aspectRatio: "2/3", borderRadius: 12, overflow: "hidden", background: "#1C1C1C", cursor: "pointer" }}>
                    <Pic src={full?.poster || e.poster} alt={e.title} />
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${e.title}`}
                    onClick={() => {
                      remove(e.id);
                      toast(`Removed “${e.title}” from My List`, () => restore(e, i));
                    }}
                    className="press press-s"
                    style={{ position: "absolute", right: 6, top: 6, display: "flex", height: 30, width: 30, alignItems: "center", justifyContent: "center", borderRadius: 999, border: 0, background: "rgba(0,0,0,.6)", backdropFilter: "blur(8px)", color: RED }}
                  >
                    <BookmarkCheck size={16} fill="rgba(239,65,48,.25)" />
                  </button>
                  <p style={{ margin: "8px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", font: "600 13px/1.3 'DM Sans',sans-serif" }}>{full?.title || e.title}</p>
                  <p style={{ margin: "2px 0 0", font: "400 11px/1.3 'DM Sans',sans-serif", color: "rgba(245,245,245,.6)" }}>{full ? kindGenre(full) : kindLabel(e.kind)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
