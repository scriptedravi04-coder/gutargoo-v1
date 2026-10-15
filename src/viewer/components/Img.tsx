import { useState } from "react";
import clsx from "clsx";

// Image with a shimmer while loading and a dark box if it fails.
export function Img({ src, alt = "", className, fit = "cover" }: { src?: string; alt?: string; className?: string; fit?: "cover" | "contain" }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className={clsx("relative overflow-hidden bg-[#212121]", className)}>
      {!loaded && !failed && <div className="shimmer absolute inset-0" />}
      {src && !failed && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={clsx("absolute inset-0 h-full w-full transition-opacity duration-300", fit === "cover" ? "object-cover" : "object-contain", loaded ? "opacity-100" : "opacity-0")}
        />
      )}
      {(failed || !src) && alt && (
        <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs font-semibold text-white/60">{alt}</div>
      )}
    </div>
  );
}
