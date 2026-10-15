import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { toast } from "sonner";
import { AlertCircle, Copy, Gift, Loader2, Pencil, Plus, RefreshCw, Trash2, Wand2 } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type CodeType = "coins" | "subscription" | "premium";

interface Redeem {
  _id: string;
  code: string;
  description?: string;
  type: CodeType;
  value: number;
  expiryDate: string;
  maxUses: number;
  usedCount: number;
  usersCount?: number;
  showInApp?: boolean;
  isActive: boolean;
  reward?: string;
  createdAt?: string;
}

const TYPE_INFO: Record<CodeType, { label: string; help: string; valueLabel: string; valueHelp: string }> = {
  coins: {
    label: "Coins",
    help: "Adds coins to the user's wallet.",
    valueLabel: "Number of coins",
    valueHelp: "How many coins the user gets.",
  },
  subscription: {
    label: "Subscription",
    help: "Adds days to the user's subscription.",
    valueLabel: "Number of days",
    valueHelp: "How many subscription days the user gets.",
  },
  premium: {
    label: "Premium",
    help: "Makes the user premium for a number of days.",
    valueLabel: "Premium days (0 = forever)",
    valueHelp: "Enter 0 to make the user premium forever.",
  },
};

const isExpired = (d: string) => !!d && new Date(d).getTime() < Date.now();
const fmtDate = (d?: string) => {
  if (!d) return "–";
  const x = new Date(d);
  return isNaN(x.getTime()) ? "–" : format(x, "d MMM yyyy");
};

const generateCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `GUTAR-${s}`;
};

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${text}`);
  } catch {
    toast.error("Could not copy. Please select and copy it manually.");
  }
};

export default function RedeemCode() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Redeem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Redeem | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["redeem-codes"],
    queryFn: async () => (await api.get("/redeem/admin/all")).data.data as Redeem[],
  });

  const toggle = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<Redeem> }) => (await api.put(`/redeem/admin/${id}`, body)).data,
    onSuccess: (res) => {
      toast.success(res?.message || "Updated");
      qc.invalidateQueries({ queryKey: ["redeem-codes"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/redeem/admin/${id}`)).data,
    onSuccess: (res) => {
      toast.success(res?.message || "Code deleted");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["redeem-codes"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const codes = data || [];
  const busyId = toggle.isPending ? toggle.variables?.id : null;

  return (
    <div>
      <PageHeader
        title="Redeem codes"
        description="Codes users can enter in the app to get coins, subscription days or premium."
        actions={
          <Button type="button" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New code
          </Button>
        }
      />

      {isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="font-medium">Could not load redeem codes</p>
            <p className="text-sm text-muted-foreground">{errorMessage(error)}</p>
            <Button type="button" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : codes.length === 0 ? (
        <EmptyState
          icon={<Gift className="h-8 w-8" />}
          title="No redeem codes yet"
          description="Create a code and share it with your users, or show it inside the app."
          action={
            <Button type="button" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New code
            </Button>
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Reward</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Show in app</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((c) => {
                  const expired = isExpired(c.expiryDate);
                  const full = c.usedCount >= c.maxUses;
                  return (
                    <TableRow key={c._id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-semibold">{c.code}</span>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(c.code)} title="Copy code">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {c.description && <p className="max-w-[220px] truncate text-xs text-muted-foreground">{c.description}</p>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{c.reward || `${c.value} ${c.type}`}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="text-sm">
                          {c.usedCount} / {c.maxUses}
                        </span>
                        {full && (
                          <span className="ml-2">
                            <StatusPill tone="wait">Used up</StatusPill>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className={expired ? "text-sm font-medium text-destructive" : "text-sm"}>
                          {fmtDate(c.expiryDate)}
                          {expired && " (expired)"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={!!c.isActive}
                          disabled={busyId === c._id}
                          onCheckedChange={(v) => toggle.mutate({ id: c._id, body: { isActive: v } })}
                          aria-label="Active"
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={c.showInApp !== false}
                          disabled={busyId === c._id}
                          onCheckedChange={(v) => toggle.mutate({ id: c._id, body: { showInApp: v } })}
                          aria-label="Show in app"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon" onClick={() => setEditing(c)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => setDeleting(c)} title="Delete" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <CodeDialog
        open={creating || !!editing}
        code={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        title={`Delete code ${deleting?.code || ""}?`}
        description="Users will no longer be able to use this code. Rewards already given stay with the users."
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting._id)}
        onOpenChange={(o) => !o && !remove.isPending && setDeleting(null)}
      />
    </div>
  );
}

interface FormState {
  code: string;
  type: CodeType;
  value: string;
  maxUses: string;
  expiryDate: string;
  description: string;
  showInApp: boolean;
  isActive: boolean;
}

const emptyForm = (): FormState => ({
  code: "",
  type: "coins",
  value: "",
  maxUses: "100",
  expiryDate: format(addDays(new Date(), 30), "yyyy-MM-dd"),
  description: "",
  showInApp: true,
  isActive: true,
});

function CodeDialog({ open, code, onClose }: { open: boolean; code: Redeem | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!code;
  const [f, setF] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (code) {
      setF({
        code: code.code,
        type: code.type,
        value: String(code.value ?? 0),
        maxUses: String(code.maxUses ?? 1),
        expiryDate: code.expiryDate ? format(new Date(code.expiryDate), "yyyy-MM-dd") : "",
        description: code.description || "",
        showInApp: code.showInApp !== false,
        isActive: !!code.isActive,
      });
    } else {
      setF(emptyForm());
    }
  }, [open, code]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      isEdit ? (await api.put(`/redeem/admin/${code?._id}`, body)).data : (await api.post("/redeem/admin/create", body)).data,
    onSuccess: (res) => {
      toast.success(res?.message || (isEdit ? "Code updated" : "Code created"));
      qc.invalidateQueries({ queryKey: ["redeem-codes"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Partial<Record<keyof FormState, string>> = {};
    const codeText = f.code.trim().toUpperCase().replace(/\s+/g, "");
    if (!isEdit && codeText.length < 3) errs.code = "Code must be at least 3 characters";
    const value = Number(f.value);
    if (f.value.trim() === "" || isNaN(value) || value < 0) errs.value = "Enter a number (0 or more)";
    else if (f.type !== "premium" && value < 1) errs.value = "Must be at least 1";
    const maxUses = Number(f.maxUses);
    if (!maxUses || maxUses < 1 || !Number.isInteger(maxUses)) errs.maxUses = "Must be a whole number, 1 or more";
    if (!f.expiryDate) errs.expiryDate = "Choose an expiry date";
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    // expiry at the end of the chosen day (local time)
    const expiry = new Date(`${f.expiryDate}T23:59:59`);
    const body: Record<string, unknown> = {
      type: f.type,
      value,
      maxUses,
      expiryDate: expiry.toISOString(),
      description: f.description.trim(),
      showInApp: f.showInApp,
      isActive: f.isActive,
    };
    if (!isEdit) body.code = codeText;
    save.mutate(body);
  };

  const info = TYPE_INFO[f.type];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit redeem code" : "New redeem code"}</DialogTitle>
          <DialogDescription>{isEdit ? "The code text can't be changed after creation." : "Users type this code in the app to get the reward."}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rc-code">Code *</Label>
            <div className="flex gap-2">
              <Input
                id="rc-code"
                value={f.code}
                onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s+/g, ""))}
                placeholder="e.g. DIWALI50"
                disabled={isEdit}
                className="font-mono uppercase"
              />
              {!isEdit && (
                <Button type="button" variant="outline" onClick={() => set("code", generateCode())}>
                  <Wand2 className="h-4 w-4" /> Generate
                </Button>
              )}
            </div>
            {errors.code ? <p className="text-xs text-destructive">{errors.code}</p> : !isEdit && <p className="text-xs text-muted-foreground">Letters and numbers, no spaces.</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Reward type *</Label>
              <Select value={f.type} onValueChange={(v) => set("type", v as CodeType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_INFO) as CodeType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_INFO[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{info.help}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rc-value">{info.valueLabel} *</Label>
              <Input id="rc-value" type="number" min={0} step={1} value={f.value} onChange={(e) => set("value", e.target.value)} />
              {errors.value ? <p className="text-xs text-destructive">{errors.value}</p> : <p className="text-xs text-muted-foreground">{info.valueHelp}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rc-max">Max uses *</Label>
              <Input id="rc-max" type="number" min={1} step={1} value={f.maxUses} onChange={(e) => set("maxUses", e.target.value)} />
              {errors.maxUses ? (
                <p className="text-xs text-destructive">{errors.maxUses}</p>
              ) : (
                <p className="text-xs text-muted-foreground">How many users can use it (each user once).</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rc-exp">Expiry date *</Label>
              <Input id="rc-exp" type="date" value={f.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} />
              {errors.expiryDate ? (
                <p className="text-xs text-destructive">{errors.expiryDate}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Works until the end of this day.</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rc-desc">Description</Label>
            <Textarea
              id="rc-desc"
              rows={2}
              value={f.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. Diwali offer – 50 free coins"
            />
            <p className="text-xs text-muted-foreground">Shown to users in the app. If empty, the reward is shown instead.</p>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="rc-show">Show in app</Label>
              <p className="text-xs text-muted-foreground">List this code on the app's redeem screen. Turn off for secret codes you share yourself.</p>
            </div>
            <Switch id="rc-show" checked={f.showInApp} onCheckedChange={(v) => set("showInApp", v)} />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="rc-active">Active</Label>
              <p className="text-xs text-muted-foreground">Inactive codes can't be used.</p>
            </div>
            <Switch id="rc-active" checked={f.isActive} onCheckedChange={(v) => set("isActive", v)} />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create code"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
