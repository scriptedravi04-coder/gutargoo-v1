import { KeyboardEvent, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}

// Type and press Enter (or comma) to add. Click × to remove.
export function TagInput({ value, onChange, placeholder, suggestions = [] }: Props) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const t = raw.trim();
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setText("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(text);
    } else if (e.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  const left = suggestions.filter((s) => !value.includes(s));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {v}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} onBlur={() => text && add(text)} placeholder={placeholder || "Type and press Enter"} />
      {left.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {left.slice(0, 14).map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
