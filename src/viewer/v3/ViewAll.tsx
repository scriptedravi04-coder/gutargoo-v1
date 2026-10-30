// v3 "See all": every title in one Home section, 3-column grid.
import { useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCatalog } from "@v/hooks/useCatalog";
import { useGoBack } from "@v/hooks/useGoBack";
import { EASE, GlassIcon, kindGenre, Pic, PremiumBadge, Shell, TOP, useOpenDetail } from "./ui";

export default function ViewAllV3() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const c = params.get("c");
  const { sections, loading } = useCatalog();
  const goBack = useGoBack();
  const openDetail = useOpenDetail();
  const found = sections.find((s) => s.id === id);
  const items = found ? (c ? found.items.filter((it) => it.kind === c) : found.items) : [];
  return (
    <Shell nav ambient>
      <div style={{ padding: `${TOP(50)} 18px 110px`, animation: `gpIn .45s ${EASE} both` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <GlassIcon label="Back" onClick={goBack}>
            <ArrowLeft size={20} />
          </GlassIcon>
          <h1 style={{ margin: 0, minWidth: 0, font: "800 24px/1.1 Outfit,sans-serif", letterSpacing: -0.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{found?.title || (loading ? "" : "Not found")}</h1>
        </div>
        {!loading && !found && <p style={{ marginTop: 20, font: "400 14px/1.5 'DM Sans',sans-serif", color: "rgba(245,245,245,.68)" }}>This row may have been removed. Go back to Home to keep watching.</p>}
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "14px 10px" }}>
          {loading
            ? Array.from({ length: 9 }, (_, i) => <div key={i} className="shim" style={{ aspectRatio: "2/3", borderRadius: 12 }} />)
            : items.map((it, i) => (
                <div key={it.id} className="press" onClick={() => openDetail(it)} role="link" tabIndex={0} style={{ cursor: "pointer", animation: `gpRise .4s ${Math.min(i, 12) * 0.03}s both` }}>
                  <div style={{ position: "relative", aspectRatio: "2/3", borderRadius: 12, overflow: "hidden", background: "#1C1C1C" }}>
                    <Pic src={it.poster} alt={it.title} />
                    {!it.isFree && (
                      <span style={{ position: "absolute", left: 6, top: 6 }}>
                        <PremiumBadge size="sm" />
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "8px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", font: "600 13px/1.3 'DM Sans',sans-serif" }}>{it.title}</p>
                  <p style={{ margin: "2px 0 0", font: "400 11px/1.3 'DM Sans',sans-serif", color: "rgba(245,245,245,.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{kindGenre(it)}</p>
                </div>
              ))}
        </div>
      </div>
    </Shell>
  );
}
