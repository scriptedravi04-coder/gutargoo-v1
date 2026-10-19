import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Loader2, Megaphone, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { TagInput } from "@/components/common/TagInput";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PositionType = "start" | "mid" | "end" | "custom" | "multiple";

interface Ad {
  _id: string;
  title: string;
  vastUrl: string;
  isActive: boolean;
  positionType: PositionType;
  showAt: number;
  duration: number;
  multiplePositions: number[];
  displayOrder?: number;
}

const POSITION_OPTIONS: { value: PositionType; label: string; help: string }[] = [
  { value: "start", label: "Before the video", help: "Plays before the movie starts." },
  { value: "mid", label: "Middle", help: "Plays around the middle of the movie." },
  { value: "end", label: "After the video", help: "Plays when the movie ends." },
  { value: "custom", label: "At a specific second", help: "Plays once at the second you choose." },
  { value: "multiple", label: "At several seconds", help: "Plays at each of the seconds you list." },
];

const fmtSec = (s: number) => {
  const n = Math.max(0, Math.floor(Number(s) || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const sec = n % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
};

const positionText = (ad: Ad) => {
  switch (ad.positionType) {
    case "start":
      return "Before the video";
    case "mid":
      return "Middle";
    case "end":
      return "After the video";
    case "custom":
      return `At ${fmtSec(ad.showAt)} (${ad.showAt || 0} sec)`;
    case "multiple":
      return ad.multiplePositions?.length ? `At ${ad.multiplePositions.map(fmtSec).join(", ")}` : "At several seconds (none set)";
    default:
      return ad.positionType;
  }
};

interface FormState {
  title: string;
  vastUrl: string;
  positionType: PositionType;
  showAt: string;
  multiplePositions: string[];
  duration: string;
  isActive: boolean;
}

const emptyForm: FormState = {
  title: "",
  vastUrl: "",
  positionType: "start",
  showAt: "0",
  multiplePositions: [],
  duration: "0",
  isActive: true,
};

export default function AdsManager() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Ad | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [toDelete, setToDelete] = useState<Ad | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const adsQuery = useQuery({
    queryKey: ["ads"],
    queryFn: async () => (await api.get("/ads")).data.data as Ad[],
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (ad: Ad) => {
    setEditing(ad);
    setForm({
      title: ad.title || "",
      vastUrl: ad.vastUrl || "",
      positionType: ad.positionType || "start",
      showAt: String(ad.showAt ?? 0),
      multiplePositions: (ad.multiplePositions || []).map(String),
      duration: String(ad.duration ?? 0),
      isActive: ad.isActive,
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      editing ? (await api.put(`/ads/${editing._id}`, body)).data : (await api.post("/ads", body)).data,
    onSuccess: (res) => {
      toast.success(res?.message || "Saved");
      qc.invalidateQueries({ queryKey: ["ads"] });
      setDialogOpen(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => (await api.put(`/ads/${id}`, { isActive })).data,
    onMutate: ({ id }) => setTogglingId(id),
    onSuccess: (res) => {
      toast.success(res?.message || "Updated");
      qc.invalidateQueries({ queryKey: ["ads"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => setTogglingId(null),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/ads/${id}`)).data,
    onSuccess: (res) => {
      toast.success(res?.message || "Deleted");
      qc.invalidateQueries({ queryKey: ["ads"] });
      setToDelete(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const vastUrl = form.vastUrl.trim();
    if (!vastUrl) return toast.error("Please paste the VAST tag URL.");
    if (!/^https?:\/\/\S+$/i.test(vastUrl)) return toast.error("The VAST tag URL must start with http:// or https:// and have no spaces.");

    const duration = Number(form.duration || 0);
    if (!Number.isFinite(duration) || duration < 0) return toast.error("Duration must be 0 or more seconds.");

    const body: Record<string, unknown> = {
      title: form.title.trim(),
      vastUrl,
      positionType: form.positionType,
      duration,
      isActive: form.isActive,
    };

    if (form.positionType === "custom") {
      const showAt = Number(form.showAt);
      if (form.showAt === "" || !Number.isFinite(showAt) || showAt < 0) return toast.error("Enter the second when the ad should play (0 or more).");
      body.showAt = showAt;
    }
    if (form.positionType === "multiple") {
      const nums = form.multiplePositions.map((v) => Number(v));
      if (!nums.length) return toast.error("Add at least one second for the ad to play at.");
      if (nums.some((n) => !Number.isFinite(n) || n < 0)) return toast.error("Each position must be a number of seconds (0 or more).");
      body.multiplePositions = Array.from(new Set(nums)).sort((a, b) => a - b);
    }
    saveMutation.mutate(body);
  };

  const ads = adsQuery.data || [];
  const currentHelp = POSITION_OPTIONS.find((p) => p.value === form.positionType)?.help;

  return (
    <div>
      <PageHeader
        title="Video Ads"
        description="Video ads (VAST) that play inside the app's video player."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add ad
          </Button>
        }
      />

      <div className="mb-6 flex gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <p>
          Paste a VAST tag URL from Google Ad Manager / your ad network. The app plays the first active <b>"Before the video"</b> ad before a movie.
        </p>
      </div>

      {adsQuery.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : adsQuery.isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 py-10 text-center">
          <p className="text-sm text-destructive">{errorMessage(adsQuery.error)}</p>
          <Button type="button" variant="outline" onClick={() => adsQuery.refetch()}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      ) : ads.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-10 w-10" />}
          title="No ads yet"
          description="Add your first VAST ad tag to start showing video ads in the app."
          action={
            <Button type="button" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add ad
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>When it plays</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ads.map((ad) => (
                    <TableRow key={ad._id}>
                      <TableCell className="max-w-[260px]">
                        <div className="font-medium">{ad.title || "Untitled ad"}</div>
                        <div className="truncate text-xs text-muted-foreground" title={ad.vastUrl}>
                          {ad.vastUrl}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{positionText(ad)}</TableCell>
                      <TableCell className="whitespace-nowrap">{ad.duration ? `${ad.duration} sec` : "Full ad"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={ad.isActive}
                            disabled={togglingId === ad._id}
                            onCheckedChange={(v) => toggleMutation.mutate({ id: ad._id, isActive: v })}
                            aria-label="Active"
                          />
                          <StatusPill tone={ad.isActive ? "ok" : "none"}>{ad.isActive ? "On" : "Off"}</StatusPill>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(ad)} aria-label="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => setToDelete(ad)} aria-label="Delete">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !saveMutation.isPending && setDialogOpen(o)}>
        <DialogContent className="overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit ad" : "Add ad"}</DialogTitle>
            <DialogDescription>Paste the VAST tag URL your ad network gave you and choose when it plays.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ad-title">Title</Label>
              <Input id="ad-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Google pre-roll" />
              <p className="text-xs text-muted-foreground">Only for you, to recognise this ad. Not shown in the app.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ad-vast">VAST tag URL *</Label>
              <Input
                id="ad-vast"
                value={form.vastUrl}
                onChange={(e) => set("vastUrl", e.target.value)}
                placeholder="https://pubads.g.doubleclick.net/gampad/ads?..."
              />
              <p className="text-xs text-muted-foreground">Must start with http:// or https://</p>
            </div>

            <div className="space-y-1.5">
              <Label>When should it play?</Label>
              <Select value={form.positionType} onValueChange={(v) => set("positionType", v as PositionType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POSITION_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentHelp && <p className="text-xs text-muted-foreground">{currentHelp}</p>}
            </div>

            {form.positionType === "custom" && (
              <div className="space-y-1.5">
                <Label htmlFor="ad-showat">Play at (seconds) *</Label>
                <Input id="ad-showat" type="number" min={0} value={form.showAt} onChange={(e) => set("showAt", e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  Seconds from the start of the movie. Example: 600 = 10 minutes{Number(form.showAt) > 0 ? ` (now: ${fmtSec(Number(form.showAt))})` : ""}.
                </p>
              </div>
            )}

            {form.positionType === "multiple" && (
              <div className="space-y-1.5">
                <Label>Play at these seconds *</Label>
                <TagInput
                  value={form.multiplePositions}
                  onChange={(v) => set("multiplePositions", v.filter((x) => x.trim() !== "" && Number.isFinite(Number(x)) && Number(x) >= 0))}
                  placeholder="Type seconds (e.g. 600) and press Enter"
                />
                <p className="text-xs text-muted-foreground">Example: 600, 1800, 3600 = at 10 min, 30 min and 1 hour. Only numbers are kept.</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="ad-duration">Duration (seconds)</Label>
              <Input id="ad-duration" type="number" min={0} value={form.duration} onChange={(e) => set("duration", e.target.value)} />
              <p className="text-xs text-muted-foreground">0 = play the full ad.</p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="ad-active">Active</Label>
                <p className="text-xs text-muted-foreground">Only active ads are sent to the app.</p>
              </div>
              <Switch id="ad-active" checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" disabled={saveMutation.isPending} onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : "Add ad"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this ad?"
        description={`"${toDelete?.title || "Untitled ad"}" will stop playing in the app. This cannot be undone.`}
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete._id)}
        onOpenChange={(o) => !o && !deleteMutation.isPending && setToDelete(null)}
      />
    </div>
  );
}
