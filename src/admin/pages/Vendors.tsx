import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type VendorStatus = "active" | "inactive";

interface Vendor {
  _id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  revenueShare: number;
  status: VendorStatus;
  notes: string;
  movieCount: number;
}

interface FormState {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  revenueShare: string;
  status: VendorStatus;
  notes: string;
}

const emptyForm: FormState = { name: "", contactPerson: "", email: "", phone: "", revenueShare: "0", status: "active", notes: "" };

export default function Vendors() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [toDelete, setToDelete] = useState<Vendor | null>(null);

  const vendorsQuery = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => (await api.get("/vendors")).data.data as Vendor[],
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (v: Vendor) => {
    setEditing(v);
    setForm({
      name: v.name || "",
      contactPerson: v.contactPerson || "",
      email: v.email || "",
      phone: v.phone || "",
      revenueShare: String(v.revenueShare ?? 0),
      status: v.status === "inactive" ? "inactive" : "active",
      notes: v.notes || "",
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      editing ? (await api.put(`/vendors/${editing._id}`, body)).data : (await api.post("/vendors", body)).data,
    onSuccess: (res) => {
      toast.success(res?.message || "Saved");
      qc.invalidateQueries({ queryKey: ["vendors"] });
      setDialogOpen(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/vendors/${id}`)).data,
    onSuccess: (res) => {
      toast.success(res?.message || "Deleted");
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["movies"] });
      setToDelete(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return toast.error("Please enter the vendor name.");
    const email = form.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Please enter a valid email address (or leave it empty).");
    const share = form.revenueShare.trim() === "" ? 0 : Number(form.revenueShare);
    if (!Number.isFinite(share) || share < 0 || share > 100) return toast.error("Revenue share must be between 0 and 100.");
    saveMutation.mutate({
      name,
      contactPerson: form.contactPerson.trim(),
      email,
      phone: form.phone.trim(),
      revenueShare: share,
      status: form.status,
      notes: form.notes.trim(),
    });
  };

  const vendors = vendorsQuery.data || [];

  return (
    <div>
      <PageHeader
        title="Content Vendors"
        description="Partners and studios who supply movies. Link a movie to a vendor from the movie's form."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add vendor
          </Button>
        }
      />

      {vendorsQuery.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : vendorsQuery.isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 py-10 text-center">
          <p className="text-sm text-destructive">{errorMessage(vendorsQuery.error)}</p>
          <Button type="button" variant="outline" onClick={() => vendorsQuery.refetch()}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      ) : vendors.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-10 w-10" />}
          title="No vendors yet"
          description="Add the partners who give you content, so you can track whose movies are on the app."
          action={
            <Button type="button" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add vendor
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
                    <TableHead>Name</TableHead>
                    <TableHead>Contact person</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Revenue share</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Movies</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.map((v) => (
                    <TableRow key={v._id}>
                      <TableCell className="font-medium">
                        {v.name}
                        {v.notes && (
                          <div className="max-w-[220px] truncate text-xs font-normal text-muted-foreground" title={v.notes}>
                            {v.notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{v.contactPerson || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {v.email ? (
                          <a href={`mailto:${v.email}`} className="text-primary hover:underline">
                            {v.email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{v.phone || "—"}</TableCell>
                      <TableCell className="text-right">{v.revenueShare ?? 0}%</TableCell>
                      <TableCell>
                        <StatusPill tone={v.status === "inactive" ? "none" : "ok"}>{v.status === "inactive" ? "Inactive" : "Active"}</StatusPill>
                      </TableCell>
                      <TableCell className="text-right">{v.movieCount ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(v)} aria-label="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => setToDelete(v)} aria-label="Delete">
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit vendor" : "Add vendor"}</DialogTitle>
            <DialogDescription>Only the name is required.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="v-name">Vendor name *</Label>
              <Input id="v-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Shemaroo" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-contact">Contact person</Label>
              <Input id="v-contact" value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="v-email">Email</Label>
                <Input id="v-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-phone">Phone</Label>
                <Input id="v-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="v-share">Revenue share (%)</Label>
                <Input
                  id="v-share"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={form.revenueShare}
                  onChange={(e) => set("revenueShare", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">The vendor's share of revenue, 0 to 100.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v as VendorStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-notes">Notes</Label>
              <Textarea id="v-notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Contract details, payment terms…" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" disabled={saveMutation.isPending} onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : "Add vendor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this vendor?"
        description={
          toDelete?.movieCount
            ? `"${toDelete.name}" will be deleted. Its ${toDelete.movieCount} movie(s) stay on the app but will be marked as "Internal".`
            : `"${toDelete?.name || ""}" will be deleted. This cannot be undone.`
        }
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete._id)}
        onOpenChange={(o) => !o && !deleteMutation.isPending && setToDelete(null)}
      />
    </div>
  );
}
