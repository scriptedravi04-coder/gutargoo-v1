import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderTree, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CategoryType = "movie" | "webseries" | "tvshows";

interface Category {
  _id: string;
  name: string;
  categoryType: CategoryType;
  createdAt?: string;
}

const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  movie: "Movies",
  webseries: "Web Series",
  tvshows: "TV Shows",
};

const typeLabel = (t?: string) => CATEGORY_TYPE_LABELS[t as CategoryType] || t || "—";

export default function Categories() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Category | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType | "">("");
  const [formError, setFormError] = useState("");
  const [toDelete, setToDelete] = useState<Category | null>(null);

  const list = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/category")).data.data as Category[],
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = { name: name.trim(), categoryType: type };
      const res = editing ? await api.put(`/category/${editing._id}`, body) : await api.post("/category", body);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Saved");
      qc.invalidateQueries({ queryKey: ["categories"] });
      setFormOpen(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/category/${id}`)).data,
    onSuccess: (data) => {
      toast.success(data?.message || "Category deleted");
      qc.invalidateQueries({ queryKey: ["categories"] });
      setToDelete(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const openForm = (c: Category | null) => {
    setEditing(c);
    setName(c?.name || "");
    setType(c?.categoryType || "");
    setFormError("");
    setFormOpen(true);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setFormError("Please enter a category name.");
    if (!type) return setFormError("Please choose what this category holds.");
    setFormError("");
    save.mutate();
  };

  const categories = list.data || [];

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Categories are the tabs in the app (for example Movies, Web Series, TV Shows)."
        actions={
          <Button type="button" onClick={() => openForm(null)}>
            <Plus className="h-4 w-4 mr-1" /> Add category
          </Button>
        }
      />

      {list.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        <EmptyState
          title="Could not load categories"
          description={errorMessage(list.error)}
          action={
            <Button type="button" variant="outline" onClick={() => list.refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Retry
            </Button>
          }
        />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={<FolderTree className="h-8 w-8" />}
          title="No categories yet"
          description="Add your first category. It will show up as a tab in the app."
          action={
            <Button type="button" onClick={() => openForm(null)}>
              <Plus className="h-4 w-4 mr-1" /> Add category
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
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((c) => (
                    <TableRow key={c._id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{typeLabel(c.categoryType)}</Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button type="button" variant="ghost" size="icon" onClick={() => openForm(c)} aria-label={`Edit ${c.name}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => setToDelete(c)} aria-label={`Delete ${c.name}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={formOpen} onOpenChange={(o) => !save.isPending && setFormOpen(o)}>
        <DialogContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit category" : "Add category"}</DialogTitle>
              <DialogDescription>This name is shown as a tab in the app.</DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Name *</Label>
              <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Movies" maxLength={60} autoFocus />
            </div>

            <div className="space-y-1.5">
              <Label>What does it hold? *</Label>
              <Select value={type} onValueChange={(v) => setType(v as CategoryType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="movie">Movies</SelectItem>
                  <SelectItem value="webseries">Web Series</SelectItem>
                  <SelectItem value="tvshows">TV Shows</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Decides which kind of content appears under this tab.</p>
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={save.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {editing ? "Save changes" : "Add category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete "${toDelete?.name}"?`}
        description="This category will be removed from the app. Home sections, banners and series linked to it will be unlinked (they are not deleted)."
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete._id)}
        onOpenChange={(o) => !o && !remove.isPending && setToDelete(null)}
      />
    </div>
  );
}
