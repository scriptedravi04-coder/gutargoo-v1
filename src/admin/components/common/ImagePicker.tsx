import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  hint?: string;
  value?: string; // current image URL
  file?: File | null; // newly picked file
  onChange: (file: File | null) => void;
  aspect?: "square" | "portrait" | "landscape" | "wide";
  className?: string;
}

const ASPECT = { square: "aspect-square", portrait: "aspect-[2/3]", landscape: "aspect-video", wide: "aspect-[21/9]" };
const MAX_MB = 20;

export function ImagePicker({ label, hint, value, file, onChange, aspect = "landscape", className }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | undefined>(value);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) {
      setPreview(value);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, value]);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="text-sm font-medium">{label}</div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={cn(
          "relative w-full overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/40 hover:border-primary/60 transition-colors",
          ASPECT[aspect]
        )}
      >
        {preview ? (
          <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImagePlus className="h-6 w-6" />
            <span className="text-xs">Click to choose</span>
          </div>
        )}
        {file && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white"
            title="Undo"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > MAX_MB * 1024 * 1024) {
            setError(`Image is larger than ${MAX_MB} MB`);
            return;
          }
          setError("");
          onChange(f);
        }}
      />
    </div>
  );
}
