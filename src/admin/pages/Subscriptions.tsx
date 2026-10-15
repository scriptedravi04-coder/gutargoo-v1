import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CreditCard, Info, Loader2, Pencil, Plus, RefreshCw, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { TagInput } from "@/components/common/TagInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Plan {
  _id: string;
  name: string;
  price: number;
  originalPrice: number;
  durationDays: number;
  features: string[];
  googlePlayProductId: string;
  appleProductId: string;
  isPopular: boolean;
  isActive: boolean;
  displayOrder: number;
}

interface FormState {
  name: string;
  price: string;
  originalPrice: string;
  durationDays: string;
  features: string[];
  googlePlayProductId: string;
  appleProductId: string;
  isPopular: boolean;
  isActive: boolean;
  displayOrder: string;
}

const emptyForm: FormState = {
  name: "",
  price: "",
  originalPrice: "",
  durationDays: "30",
  features: [],
  googlePlayProductId: "",
  appleProductId: "",
  isPopular: false,
  isActive: true,
  displayOrder: "0",
};

const QUICK_DAYS = [
  { days: 30, label: "1 month" },
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "1 year" },
];

const durationLabel = (days: number) => {
  const d = Number(days) || 0;
  if (d === 365 || d === 366) return "1 year";
  if (d > 0 && d % 365 === 0) return `${d / 365} years`;
  if (d > 0 && d % 30 === 0) return d === 30 ? "1 month" : `${d / 30} months`;
  if (d > 0 && d % 7 === 0) return d === 7 ? "1 week" : `${d / 7} weeks`;
  return d === 1 ? "1 day" : `${d} days`;
};

const rupees = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN")}`;

export default function Subscriptions() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Plan | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [toDelete, setToDelete] = useState<Plan | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: async () => (await api.get("/plans/admin/all")).data.data as Plan[],
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: Plan) => {
    setEditing(p);
    setForm({
      name: p.name || "",
      price: String(p.price ?? ""),
      originalPrice: p.originalPrice ? String(p.originalPrice) : "",
      durationDays: String(p.durationDays ?? ""),
      features: p.features || [],
      googlePlayProductId: p.googlePlayProductId || "",
      appleProductId: p.appleProductId || "",
      isPopular: !!p.isPopular,
      isActive: !!p.isActive,
      displayOrder: String(p.displayOrder ?? 0),
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      editing ? (await api.put(`/plans/${editing._id}`, body)).data : (await api.post("/plans", body)).data,
    onSuccess: (res) => {
      toast.success(res?.message || "Saved");
      qc.invalidateQueries({ queryKey: ["plans"] });
      setDialogOpen(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => (await api.put(`/plans/${id}`, { isActive })).data,
    onMutate: ({ id }) => setTogglingId(id),
    onSuccess: (res) => {
      toast.success(res?.message || "Updated");
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => setTogglingId(null),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/plans/${id}`)).data,
    onSuccess: (res) => {
      toast.success(res?.message || "Deleted");
      qc.invalidateQueries({ queryKey: ["plans"] });
      setToDelete(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return toast.error("Please enter a plan name.");
    const price = Number(form.price);
    if (form.price.trim() === "" || !Number.isFinite(price) || price < 0) return toast.error("Please enter a valid price (0 or more).");
    const originalPrice = form.originalPrice.trim() === "" ? 0 : Number(form.originalPrice);
    if (!Number.isFinite(originalPrice) || originalPrice < 0) return toast.error("Original price must be a number (0 or more).");
    const durationDays = Number(form.durationDays);
    if (!Number.isInteger(durationDays) || durationDays < 1) return toast.error("Duration must be at least 1 day (whole number).");
    const displayOrder = form.displayOrder.trim() === "" ? 0 : Number(form.displayOrder);
    if (!Number.isFinite(displayOrder)) return toast.error("Display order must be a number.");

    saveMutation.mutate({
      name,
      price,
      originalPrice,
      durationDays,
      features: form.features,
      googlePlayProductId: form.googlePlayProductId.trim(),
      appleProductId: form.appleProductId.trim(),
      isPopular: form.isPopular,
      isActive: form.isActive,
      displayOrder,
    });
  };

  const plans = plansQuery.data || [];

  return (
    <div>
      <PageHeader
        title="Subscription Plans"
        description="Plans people can buy for Gutargoo Plus."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add plan
          </Button>
        }
      />

      <div className="mb-6 flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p>
          Plans are saved here and available at <code className="rounded bg-muted px-1">/api/plans</code>, but the current app version has no purchase
          screen yet — they will appear after the next app update.
        </p>
      </div>

      {plansQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : plansQuery.isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 py-10 text-center">
          <p className="text-sm text-destructive">{errorMessage(plansQuery.error)}</p>
          <Button type="button" variant="outline" onClick={() => plansQuery.refetch()}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-10 w-10" />}
          title="No plans yet"
          description="Create your first subscription plan, for example a monthly and a yearly plan."
          action={
            <Button type="button" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add plan
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <Card key={p._id} className={cn("flex flex-col", p.isPopular && "ring-2 ring-primary", !p.isActive && "opacity-70")}>
              <CardContent className="flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">{p.name}</p>
                    <p className="text-sm text-muted-foreground">{durationLabel(p.durationDays)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {p.isPopular && (
                      <Badge className="gap-1">
                        <Star className="h-3 w-3" /> Popular
                      </Badge>
                    )}
                    {!p.isActive && <Badge variant="secondary">Hidden</Badge>}
                  </div>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{rupees(p.price)}</span>
                  {p.originalPrice > p.price && <span className="text-sm text-muted-foreground line-through">{rupees(p.originalPrice)}</span>}
                </div>

                {p.features?.length > 0 ? (
                  <ul className="space-y-1.5 text-sm">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No features listed.</p>
                )}

                {(p.googlePlayProductId || p.appleProductId) && (
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    {p.googlePlayProductId && <p className="truncate">Play: {p.googlePlayProductId}</p>}
                    {p.appleProductId && <p className="truncate">Apple: {p.appleProductId}</p>}
                  </div>
                )}

                <div className="mt-auto flex items-center justify-between border-t pt-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={p.isActive}
                      disabled={togglingId === p._id}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: p._id, isActive: v })}
                      aria-label="Active"
                    />
                    {p.isActive ? "Active" : "Hidden"}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit plan" : "Add plan"}</DialogTitle>
            <DialogDescription>Fields marked * are required.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="plan-name">Plan name *</Label>
              <Input id="plan-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Monthly" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="plan-price">Price (₹) *</Label>
                <Input id="plan-price" type="number" min={0} step="any" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="99" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-orig">Original price (₹)</Label>
                <Input
                  id="plan-orig"
                  type="number"
                  min={0}
                  step="any"
                  value={form.originalPrice}
                  onChange={(e) => set("originalPrice", e.target.value)}
                  placeholder="149"
                />
              </div>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">If the original price is higher, it is shown crossed out next to the price.</p>

            <div className="space-y-1.5">
              <Label htmlFor="plan-days">Duration (days) *</Label>
              <div className="flex flex-wrap gap-2">
                {QUICK_DAYS.map((q) => (
                  <Button
                    key={q.days}
                    type="button"
                    size="sm"
                    variant={Number(form.durationDays) === q.days ? "default" : "outline"}
                    onClick={() => set("durationDays", String(q.days))}
                  >
                    {q.label}
                  </Button>
                ))}
              </div>
              <Input id="plan-days" type="number" min={1} step={1} value={form.durationDays} onChange={(e) => set("durationDays", e.target.value)} />
              {Number(form.durationDays) > 0 && <p className="text-xs text-muted-foreground">= {durationLabel(Number(form.durationDays))}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Features</Label>
              <TagInput
                value={form.features}
                onChange={(v) => set("features", v)}
                placeholder="Type a feature and press Enter"
                suggestions={["Ad-free", "Full HD", "Watch on 2 devices", "Download & watch offline", "All originals"]}
              />
              <p className="text-xs text-muted-foreground">Short points shown on the plan card.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plan-gp">Google Play product ID</Label>
              <Input id="plan-gp" value={form.googlePlayProductId} onChange={(e) => set("googlePlayProductId", e.target.value)} placeholder="e.g. plus_monthly" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-apple">Apple product ID</Label>
              <Input id="plan-apple" value={form.appleProductId} onChange={(e) => set("appleProductId", e.target.value)} placeholder="e.g. com.gutargoo.plus.monthly" />
              <p className="text-xs text-muted-foreground">
                Copy these product IDs from Google Play Console and App Store Connect (in-app products / subscriptions). Leave empty if not created yet.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plan-order">Display order</Label>
              <Input id="plan-order" type="number" value={form.displayOrder} onChange={(e) => set("displayOrder", e.target.value)} />
              <p className="text-xs text-muted-foreground">Smaller numbers are shown first.</p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="plan-popular">Mark as Popular</Label>
                <p className="text-xs text-muted-foreground">Highlights this plan with a "Popular" badge.</p>
              </div>
              <Switch id="plan-popular" checked={form.isPopular} onCheckedChange={(v) => set("isPopular", v)} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="plan-active">Active</Label>
                <p className="text-xs text-muted-foreground">Only active plans are listed at /api/plans.</p>
              </div>
              <Switch id="plan-active" checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" disabled={saveMutation.isPending} onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : "Add plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this plan?"
        description={`The plan "${toDelete?.name || ""}" will be removed. This cannot be undone. Tip: you can turn it off instead to hide it.`}
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete._id)}
        onOpenChange={(o) => !o && !deleteMutation.isPending && setToDelete(null)}
      />
    </div>
  );
}
