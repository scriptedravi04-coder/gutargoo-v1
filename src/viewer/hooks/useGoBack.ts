import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/** Back to the previous page, or Home when the page was opened directly (shared link). */
export function useGoBack() {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === "number" && idx > 0) navigate(-1);
    else navigate("/", { replace: true });
  }, [navigate]);
}
