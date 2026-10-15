import { FormEvent, ReactNode, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface HomeSettingsData {
  bannerLimit: number;
  bannerAutoSlideSeconds: number;
  showContinueWatching: boolean;
  showTop10: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  minAppVersionAndroid: string;
  minAppVersionIos: string;
  supportEmail: string;
  supportWhatsapp: string;
}

// Form keeps numbers as text so the inputs can be cleared while typing
interface FormState extends Omit<HomeSettingsData, "bannerLimit" | "bannerAutoSlideSeconds"> {
  bannerLimit: string;
  bannerAutoSlideSeconds: string;
}

const toForm = (d: Partial<HomeSettingsData> = {}): FormState => ({
  bannerLimit: String(d.bannerLimit ?? 5),
  bannerAutoSlideSeconds: String(d.bannerAutoSlideSeconds ?? 5),
  showContinueWatching: d.showContinueWatching ?? true,
  showTop10: d.showTop10 ?? true,
  maintenanceMode: d.maintenanceMode ?? false,
  maintenanceMessage: d.maintenanceMessage ?? "",
  minAppVersionAndroid: d.minAppVersionAndroid ?? "",
  minAppVersionIos: d.minAppVersionIos ?? "",
  supportEmail: d.supportEmail ?? "",
  supportWhatsapp: d.supportWhatsapp ?? "",
});

const VERSION_RE = /^\d+(\.\d+){0,3}$/;

function SwitchRow({ id, label, help, checked, onChange }: { id: string; label: string; help?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div>
        <Label htmlFor={id}>{label}</Label>
        {help && <p className="text-xs text-muted-foreground">{help}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function HomeSettings() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(toForm());
  // full object from the server, so keys this page doesn't know about are kept on save
  const [serverData, setServerData] = useState<Record<string, unknown>>({});

  const settingsQuery = useQuery({
    queryKey: ["settings", "home"],
    queryFn: async () => (await api.get("/settings/home")).data.data as Record<string, unknown>,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setServerData(settingsQuery.data);
      setForm(toForm(settingsQuery.data as Partial<HomeSettingsData>));
    }
  }, [settingsQuery.data]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await api.put("/settings/home", body)).data,
    onSuccess: (res) => {
      toast.success(res?.message || "Settings saved");
      qc.invalidateQueries({ queryKey: ["settings", "home"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const bannerLimit = Number(form.bannerLimit);
    if (!Number.isInteger(bannerLimit) || bannerLimit < 1 || bannerLimit > 50) return toast.error("Number of banners must be a whole number from 1 to 50.");
    const slide = Number(form.bannerAutoSlideSeconds);
    if (!Number.isFinite(slide) || slide < 0 || slide > 120) return toast.error("Auto-slide time must be between 0 and 120 seconds.");
    const android = form.minAppVersionAndroid.trim();
    const ios = form.minAppVersionIos.trim();
    if (android && !VERSION_RE.test(android)) return toast.error("Minimum Android version should look like 1.2.3 (or leave it empty).");
    if (ios && !VERSION_RE.test(ios)) return toast.error("Minimum iOS version should look like 1.2.3 (or leave it empty).");
    const email = form.supportEmail.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Please enter a valid support email (or leave it empty).");
    const whatsapp = form.supportWhatsapp.trim();
    if (whatsapp && !/^\+?[\d\s-]{7,20}$/.test(whatsapp)) return toast.error("WhatsApp number should contain only digits, e.g. +91 98765 43210.");
    if (form.maintenanceMode && !form.maintenanceMessage.trim())
      return toast.error("Please write a short maintenance message for users, or turn maintenance mode off.");

    saveMutation.mutate({
      ...serverData,
      bannerLimit,
      bannerAutoSlideSeconds: slide,
      showContinueWatching: form.showContinueWatching,
      showTop10: form.showTop10,
      maintenanceMode: form.maintenanceMode,
      maintenanceMessage: form.maintenanceMessage.trim(),
      minAppVersionAndroid: android,
      minAppVersionIos: ios,
      supportEmail: email,
      supportWhatsapp: whatsapp,
    });
  };

  return (
    <div>
      <PageHeader title="Home & App Settings" description="General settings for the app's home screen, maintenance and support." />

      <div className="mb-6 flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p>
          Saved on the server at <code className="rounded bg-muted px-1">/api/settings/home</code>. The current app version doesn't read these yet — they
          take effect after the app is updated to use them.
        </p>
      </div>

      {settingsQuery.isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : settingsQuery.isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 py-10 text-center">
          <p className="text-sm text-destructive">{errorMessage(settingsQuery.error)}</p>
          <Button type="button" variant="outline" onClick={() => settingsQuery.refetch()}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Home screen</CardTitle>
              <CardDescription>How the home screen looks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="hs-banners">Number of banners</Label>
                  <Input id="hs-banners" type="number" min={1} max={50} value={form.bannerLimit} onChange={(e) => set("bannerLimit", e.target.value)} />
                  <p className="text-xs text-muted-foreground">How many top banners to show at most.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hs-slide">Banner auto-slide (seconds)</Label>
                  <Input
                    id="hs-slide"
                    type="number"
                    min={0}
                    max={120}
                    value={form.bannerAutoSlideSeconds}
                    onChange={(e) => set("bannerAutoSlideSeconds", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Time before the next banner slides in. 0 = no auto-slide.</p>
                </div>
              </div>
              <SwitchRow
                id="hs-continue"
                label="Show “Continue Watching”"
                help="Row with movies the user started but didn't finish."
                checked={form.showContinueWatching}
                onChange={(v) => set("showContinueWatching", v)}
              />
              <SwitchRow id="hs-top10" label="Show “Top 10”" help="Row with the top 10 movies." checked={form.showTop10} onChange={(v) => set("showTop10", v)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Maintenance</CardTitle>
              <CardDescription>Temporarily block the app while you fix something.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SwitchRow
                id="hs-maint"
                label="Maintenance mode"
                help="When on, users see the message below instead of the app."
                checked={form.maintenanceMode}
                onChange={(v) => set("maintenanceMode", v)}
              />
              <div className="space-y-1.5">
                <Label htmlFor="hs-maint-msg">Maintenance message{form.maintenanceMode ? " *" : ""}</Label>
                <Textarea
                  id="hs-maint-msg"
                  rows={3}
                  value={form.maintenanceMessage}
                  onChange={(e) => set("maintenanceMessage", e.target.value)}
                  placeholder="We're improving Gutargoo. Please check back in a little while."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Force update</CardTitle>
              <CardDescription>Users on an older version will be asked to update. Leave empty to not force updates.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="hs-android">Minimum Android version</Label>
                <Input id="hs-android" value={form.minAppVersionAndroid} onChange={(e) => set("minAppVersionAndroid", e.target.value)} placeholder="e.g. 1.4.0" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hs-ios">Minimum iOS version</Label>
                <Input id="hs-ios" value={form.minAppVersionIos} onChange={(e) => set("minAppVersionIos", e.target.value)} placeholder="e.g. 1.4.0" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Support contact</CardTitle>
              <CardDescription>Where users can reach you for help.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="hs-email">Support email</Label>
                <Input id="hs-email" type="email" value={form.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} placeholder="support@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hs-wa">Support WhatsApp number</Label>
                <Input id="hs-wa" type="tel" value={form.supportWhatsapp} onChange={(e) => set("supportWhatsapp", e.target.value)} placeholder="+91 98765 43210" />
                <p className="text-xs text-muted-foreground">With country code.</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save settings
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
