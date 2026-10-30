import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/imageCompress";

interface Props {
  label: string;
  hint?: string;
  value?: string; // current image URL
  file?: File | null; // newly picked file
  onChange: (file: File | null) => void;
  aspect?: "square" | "portrait" | "landscape" | "wide";
  className?: string;
  /** optional images only: lets the admin remove the SAVED image (value) */
  removed?: boolean;
  onRemoveChange?: (removed: boolean) => void;
}

const ASPECT = { square: "aspect-square", portrait: "aspect-[2/3]", landscape: "aspect-video", wide: "aspect-[21/9]" };
const MAX_MB = 20;

export function ImagePicker({ label, hint, value, file, onChange, aspect = "landscape", className, removed, onRemoveChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | undefined>(value);
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const pickSeq = useRef(0);
  useEffect(
    () => () => {
      pickSeq.current++; // ignore a compression that finishes after unmount
    },
    []
  );

  const pick = async (f: File) => {
    const seq = ++pickSeq.current;
    setError("");
    setPreparing(true);
    const out = await compressImage(f);
    if (seq !== pickSeq.current) return;
    setPreparing(false);
    if (out.size > MAX_MB * 1024 * 1024) {
      setError(`Image is larger than ${MAX_MB} MB`);
      return;
    }
    onRemoveChange?.(false);
    onChange(out);
  };

  useEffect(() => {
    if (!file) {
      setPreview(removed ? undefined : value);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, value, removed]);

  const canRemoveSaved = !!onRemoveChange && !!value && !file && !removed;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="text-sm font-medium">{label}</div>
      <div className="relative">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={preparing}
          aria-label={`${label}: choose image`}
          className={cn(
            "relative block w-full overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/40 hover:border-primary/60 transition-colors",
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
          {preparing && (
            <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-background/70 text-xs">
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing…
            </div>
          )}
        </button>
        {/* separate real buttons (not inside the picker button) so they work with the keyboard too */}
        {file && !preparing && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Undo"
            aria-label="Undo new image"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {canRemoveSaved && !preparing && (
          <button
            type="button"
            onClick={() => onRemoveChange?.(true)}
            className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Remove this image"
            aria-label="Remove this image"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {removed && !file && value && (
        <p className="text-xs text-amber-600">
          This image will be removed when you save.{" "}
          <button type="button" className="underline" onClick={() => onRemoveChange?.(false)}>
            Undo
          </button>
        </p>
      )}
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
          // very big originals are refused before trying to shrink them
          if (f.size > MAX_MB * 4 * 1024 * 1024) {
            setError(`Image is larger than ${MAX_MB * 4} MB`);
            return;
          }
          void pick(f);
        }}
      />
    </div>
  );
}
