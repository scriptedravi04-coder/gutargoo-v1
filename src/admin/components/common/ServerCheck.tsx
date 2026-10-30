// Tells the admin which server this panel is talking to, and which settings are missing.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { api, serverReady, ServerInfo } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function useServerInfo() {
  const [info, setInfo] = useState<ServerInfo | null>(null);
  useEffect(() => {
    let alive = true;
    serverReady.then((i) => alive && setInfo(i));
    return () => {
      alive = false;
    };
  }, []);
  return info;
}

/** Small line on the login page / dashboard. Silent when everything is right. */
export function ServerBanner({ showOk = false }: { showOk?: boolean }) {
  const info = useServerInfo();
  if (!info) return null;
  if (!info.ok)
    return (
      <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Server not reachable ({info.base}). The website/admin must run with the server part (<code>npm start</code>), not as files only.
        </span>
      </div>
    );
  if (info.app !== "gutargoo-one")
    return (
      <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          This panel is talking to an <b>old server</b> ({info.base}). Some pages will log you out or show wrong data. Open the admin on the
          new site's <b>/admin</b> address, or remove <code>VITE_BACKEND_URL</code> from the settings.
        </span>
      </div>
    );
  return showOk ? (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Server connected
    </p>
  ) : null;
}

interface SystemData {
  db: boolean;
  checks: { key: string; ok: boolean; label: string; need: string }[];
}

/** Dashboard: one button that checks the server can fetch a real video from Bunny */
export function StreamTestCard() {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; message: string; title?: string; status?: number } | null>(null);
  const run = async () => {
    setBusy(true);
    try {
      setRes((await api.get("/admin/stream-test")).data.data);
    } catch (e) {
      setRes({ ok: false, message: "Test could not run (server too old or not reachable)" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Video playback test</CardTitle>
        <CardDescription>Checks that the website can load a real movie from Bunny through this server.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Button type="button" size="sm" variant="outline" onClick={() => void run()} disabled={busy}>
          {busy ? "Testing…" : "Test now"}
        </Button>
        {res && (
          <p className={res.ok ? "flex items-center gap-2 text-green-600" : "flex items-center gap-2 text-destructive"}>
            {res.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
            <span>
              {res.message}
              {res.title ? ` (${res.title})` : ""}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Dashboard card: which .env settings are missing (never shows the values) */
export function SystemCheckCard() {
  const q = useQuery({
    queryKey: ["admin-system"],
    queryFn: async () => (await api.get("/admin/system")).data.data as SystemData,
    retry: 0,
    staleTime: 5 * 60 * 1000,
  });
  if (q.isLoading) return null;
  if (q.isError || !q.data) return <ServerBanner />;
  const missing = q.data.checks.filter((c) => !c.ok);
  if (q.data.db && !missing.length) return null;
  return (
    <Card className="mb-6 border-amber-500/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-500" /> Settings to check
        </CardTitle>
        <CardDescription>These are missing in the server settings (environment variables). Add them and restart the app.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {!q.data.db && (
          <p className="flex items-center gap-2 text-destructive">
            <XCircle className="h-4 w-4" /> Database not connected (MONGO_URI / Atlas Network Access 0.0.0.0/0)
          </p>
        )}
        {missing.map((c) => (
          <p key={c.key} className="flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0 text-destructive" />
            <span>
              {c.label} — <code className="text-xs">{c.key}</code> <span className="text-muted-foreground">({c.need})</span>
            </span>
          </p>
        ))}
      </CardContent>
    </Card>
  );
}
