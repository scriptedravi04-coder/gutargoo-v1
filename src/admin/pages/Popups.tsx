import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ImageIcon, Info, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage, toFormData } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ImagePicker } from "@/components/common/ImagePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Popup {
  _id: string;
  title: string;
  image: string;
  link: string;
  isActive: boolean;
  createdAt?: string;
}

interface FormState {
  title: string;
  link: string;
  isActive: boolean;
  file: File | null;
}

const emptyForm: FormState = { title: "", link: "", isActive: false, file: null };

const safeDate = (d?: string) => {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "" : format(dt, "d MMM yyyy");
};

export default function Popups() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Popup | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [toDelete, setToDelete] = useState<Popup | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const popupsQuery = useQuery({
    queryKey: ["popups"],
    queryFn: async () => (await api.get("/popups/admin/all")).data.data as Popup[],
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: Popup) => {
    setEditing(p);
    setForm({ title: p.title || "", link: p.link || "", isActive: p.isActive, file: null });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (fd: FormData) =>
      editing ? (await api.put(`/popups/${editing._id}`, fd)).data : (await api.post("/popups", fd)).data,
    onSuccess: (res) => {
      toast.success(res?.message || "Saved");
      qc.invalidateQueries({ queryKey: ["popups"] });
      setDialogOpen(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      (await api.put(`/popups/${id}`, toFormData({ isActive }))).data,
    onMutate: ({ id }) => setTogglingId(id),
    onSuccess: (res, vars) => {
      toast.success(vars.isActive ? "Popup is now live in the app" : res?.message || "Popup turned off");
      qc.invalidateQueries({ queryKey: ["popups"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => setTogglingId(null),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/popups/${id}`)).data,
    onSuccess: (res) => {
      toast.success(res?.message || "Deleted");
      qc.invalidateQueries({ queryKey: ["popups"] });
      setToDelete(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!editing && !form.file) return toast.error("Please choose an image for the popup.");
    if (editing && !form.file && !editing.image) return toast.error("Please choose an image for the popup.");
    const link = form.link.trim();
    if (link && !/^https?:\/\/\S+$/i.test(link)) return toast.error("The link must start with http:// or https://");
    saveMutation.mutate(
      toFormData({
        title: form.title.trim(),
        link,
        isActive: form.isActive,
        image: form.file || undefined,
      })
    );
  };

  const popups = popupsQuery.data || [];

  return (
    <div>
      <PageHeader
        title="App Popup"
        description="The image popup people see when they open the app."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add popup
          </Button>
        }
      />

      <div className="mb-6 flex gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <p>
          Only <b>one popup can be live</b> at a time. When you turn a popup on, all the others are turned off automatically. Turn all of them off to
          show no popup.
        </p>
      </div>

      {popupsQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full" />
          ))}
        </div>
      ) : popupsQuery.isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 py-10 text-center">
          <p className="text-sm text-destructive">{errorMessage(popupsQuery.error)}</p>
          <Button type="button" variant="outline" onClick={() => popupsQuery.refetch()}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      ) : popups.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="h-10 w-10" />}
          title="No popups yet"
          description="Add an image (for example an offer or a new release) to show when the app opens."
          action={
            <Button type="button" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add popup
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {popups.map((p) => (
            <Card key={p._id} className={p.isActive ? "overflow-hidden ring-2 ring-emerald-500" : "overflow-hidden"}>
              <div className="relative aspect-[2/3] bg-muted">
                {p.image ? (
                  <img src={p.image} alt={p.title || "Popup"} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
                {p.isActive && <Badge className="absolute left-2 top-2 bg-emerald-600 text-white hover:bg-emerald-600">Live in app</Badge>}
              </div>
              <CardContent className="space-y-3 p-3">
                <div>
                  <p className="truncate font-medium">{p.title || "Untitled popup"}</p>
                  {safeDate(p.createdAt) && <p className="text-xs text-muted-foreground">Added {safeDate(p.createdAt)}</p>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs">
                    <Switch
                      checked={p.isActive}
                      disabled={togglingId === p._id}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: p._id, isActive: v })}
                      aria-label="Live in app"
                    />
                    {p.isActive ? "Live" : "Off"}
                  </label>
                  <div className="flex">
                    <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setToDelete(p)} aria-label="Delete">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !saveMutation.isPending && setDialogOpen(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit popup" : "Add popup"}</DialogTitle>
            <DialogDescription>A tall (portrait) image works best.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="popup-title">Title</Label>
              <Input id="popup-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Diwali offer" />
              <p className="text-xs text-muted-foreground">Only for you, to recognise this popup.</p>
            </div>

            <ImagePicker
              label={editing ? "Image" : "Image *"}
              hint={editing ? "Click to replace the image. Leave it as is to keep the current one." : "Portrait image, e.g. 1080 × 1620 px."}
              value={editing?.image || undefined}
              file={form.file}
              onChange={(f) => set("file", f)}
              aspect="portrait"
              className="mx-auto max-w-[220px]"
            />

            <div className="space-y-1.5">
              <Label htmlFor="popup-link">Link (optional)</Label>
              <Input id="popup-link" value={form.link} onChange={(e) => set("link", e.target.value)} placeholder="https://..." />
              <p className="text-xs text-muted-foreground">For future use — the current app version does not open this link yet.</p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="popup-active">Live in app</Label>
                <p className="text-xs text-muted-foreground">Turning this on turns off every other popup.</p>
              </div>
              <Switch id="popup-active" checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" disabled={saveMutation.isPending} onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : "Add popup"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this popup?"
        description={`"${toDelete?.title || "Untitled popup"}" and its image will be removed. This cannot be undone.`}
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete._id)}
        onOpenChange={(o) => !o && !deleteMutation.isPending && setToDelete(null)}
      />
    </div>
  );
}
