import { useEffect, useState } from "react";
import clsx from "clsx";

// Image with a shimmer while loading and a dark box if it fails.
// `fallback`: a second picture tried when the first one is missing or fails to load.
export function Img({
  src,
  alt = "",
  className,
  fit = "cover",
  fallback,
  eager = false,
}: {
  src?: string;
  alt?: string;
  className?: string;
  fit?: "cover" | "contain";
  fallback?: string;
  eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setUseFallback(false);
  }, [src]);
  const first = src || "";
  const current = useFallback || !first ? fallback || "" : first;
  return (
    <div className={clsx("relative overflow-hidden bg-[#212121]", className)}>
      {!loaded && !failed && current && <div className="shimmer absolute inset-0" />}
      {current && !failed && (
        <img
          key={current}
          src={current}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (!useFallback && fallback && fallback !== current) {
              setLoaded(false);
              setUseFallback(true);
            } else setFailed(true);
          }}
          className={clsx("absolute inset-0 h-full w-full transition-opacity duration-300", fit === "cover" ? "object-cover" : "object-contain", loaded ? "opacity-100" : "opacity-0")}
          draggable={false}
        />
      )}
      {(failed || !current) && alt && (
        <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs font-semibold text-white/60">{alt}</div>
      )}
    </div>
  );
}
