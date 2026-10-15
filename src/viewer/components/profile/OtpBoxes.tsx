import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

// 6 single-digit boxes: auto-advance, backspace goes back, paste fills all
export function OtpBoxes({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [focus, setFocus] = useState<number | null>(null);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || "");

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  // after a wrong code the boxes are cleared → put the cursor back in the first box
  useEffect(() => {
    if (!value && !disabled) refs.current[0]?.focus();
  }, [value, disabled]);

  const setAt = (i: number, ch: string) => {
    const arr = [...digits];
    arr[i] = ch;
    onChange(arr.join("").slice(0, 6));
  };

  const fill = (text: string, from: number) => {
    const d = text.replace(/\D/g, "");
    if (!d) return;
    if (d.length >= 6) {
      onChange(d.slice(0, 6));
      refs.current[5]?.focus();
      return;
    }
    const arr = [...digits];
    for (let k = 0; k < d.length && from + k < 6; k++) arr[from + k] = d[k];
    onChange(arr.join(""));
    refs.current[Math.min(5, from + d.length)]?.focus();
  };

  return (
    <div className="flex justify-center gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d}
          readOnly={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`OTP digit ${i + 1}`}
          maxLength={i === 0 ? 6 : 1}
          onFocus={(e) => {
            setFocus(i);
            e.target.select();
          }}
          onBlur={() => setFocus((f) => (f === i ? null : f))}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            if (!v) return setAt(i, "");
            if (v.length > 1) return fill(v, i);
            setAt(i, v);
            if (i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) {
              e.preventDefault();
              setAt(i - 1, "");
              refs.current[i - 1]?.focus();
            } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            fill(e.clipboardData.getData("text"), i);
          }}
          className={clsx(
            "h-[52px] w-[46px] rounded-xl bg-[#1A1A1A] text-center text-xl font-semibold text-white outline-none read-only:opacity-60",
            focus === i ? "border-[1.5px] border-orange" : "border border-white/[.12]"
          )}
        />
      ))}
    </div>
  );
}
