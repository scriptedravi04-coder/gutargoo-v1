import { FormEvent, useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, RefreshCw, Search, Trash2, User, Users } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage, ImageRef, toFormData } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ImagePicker } from "@/components/common/ImagePicker";
import { Pager } from "@/components/common/Pager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ROLES = ["Director", "Producer", "Writer", "Music Director", "Cinematographer", "Editor", "Actor", "Other"];
const LIMIT = 24;
const ALL = "all";

interface Person {
  _id: string;
  personName: string;
  role: string;
  characterName?: string;
  profileImage?: ImageRef;
}

interface ListReply {
  data: Person[];
  total: number;
  totalPages: number;
}

export default function CastCrew() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState(ALL);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [personName, setPersonName] = useState("");
  const [personRole, setPersonRole] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [formError, setFormError] = useState("");
  const [toDelete, setToDelete] = useState<Person | null>(null);

  // wait until the admin stops typing
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchText.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchText]);

  const list = useQuery({
    queryKey: ["castAndCrew", page, search, role],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: LIMIT };
      if (search) params.search = search;
      if (role !== ALL) params.role = role;
      const { data } = await api.get("/castAndCrew", { params });
      return { data: data.data || [], total: data.total || 0, totalPages: data.totalPages || 0 } as ListReply;
    },
    placeholderData: keepPreviousData,
  });

  // if the last item on a page was deleted, step back a page
  useEffect(() => {
    if (list.data && page > 1 && list.data.totalPages > 0 && page > list.data.totalPages) setPage(list.data.totalPages);
  }, [list.data, page]);

  const save = useMutation({
    mutationFn: async () => {
      const fd = toFormData({
        personName: personName.trim(),
        role: personRole,
        characterName: characterName.trim(),
        profileImage: photo || undefined,
      });
      const res = editing ? await api.put(`/castAndCrew/${editing._id}`, fd) : await api.post("/castAndCrew", fd);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Saved");
      qc.invalidateQueries({ queryKey: ["castAndCrew"] });
      setFormOpen(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/castAndCrew/${id}`)).data,
    onSuccess: (data) => {
      toast.success(data?.message || "Person deleted");
      qc.invalidateQueries({ queryKey: ["castAndCrew"] });
      setToDelete(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const openForm = (p: Person | null) => {
    setEditing(p);
    setPersonName(p?.personName || "");
    setPersonRole(p?.role || "");
    setCharacterName(p?.characterName || "");
    setPhoto(null);
    setFormError("");
    setFormOpen(true);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!personName.trim()) return setFormError("Please enter the person's name.");
    if (!personRole) return setFormError("Please choose a role.");
    setFormError("");
    save.mutate();
  };

  const people = list.data?.data || [];
  const filtered = !!search || role !== ALL;

  return (
    <div>
      <PageHeader
        title="Cast & Crew"
        description="Actors, directors and other people you can attach to movies and web series."
        actions={
          <Button type="button" onClick={() => openForm(null)}>
            <Plus className="h-4 w-4 mr-1" /> Add person
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search by name…" className="pl-9" />
        </div>
        <Select
          value={role}
          onValueChange={(v) => {
            setRole(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-52">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All roles</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {list.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full rounded-xl" />
          ))}
        </div>
      ) : list.isError ? (
        <EmptyState
          title="Could not load cast & crew"
          description={errorMessage(list.error)}
          action={
            <Button type="button" variant="outline" onClick={() => list.refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Retry
            </Button>
          }
        />
      ) : people.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title={filtered ? "Nobody matches your search" : "No people added yet"}
          description={filtered ? "Try a different name or role." : "Add actors, directors and crew so you can pick them when adding content."}
          action={
            filtered ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchText("");
                  setSearch("");
                  setRole(ALL);
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button type="button" onClick={() => openForm(null)}>
                <Plus className="h-4 w-4 mr-1" /> Add person
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {people.map((p) => (
              <Card key={p._id} className="overflow-hidden">
                <div className="relative aspect-square bg-muted">
                  {p.profileImage?.url ? (
                    <img src={p.profileImage.url} alt={p.personName} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                      <User className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <CardContent className="space-y-1 p-3">
                  <p className="truncate font-medium" title={p.personName}>
                    {p.personName}
                  </p>
                  <Badge variant="secondary" className="font-normal">
                    {p.role}
                  </Badge>
                  {p.characterName && (
                    <p className="truncate text-xs text-muted-foreground" title={p.characterName}>
                      as {p.characterName}
                    </p>
                  )}
                  <div className="flex justify-end gap-1 pt-1">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openForm(p)} aria-label={`Edit ${p.personName}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setToDelete(p)} aria-label={`Delete ${p.personName}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Pager page={page} totalPages={list.data?.totalPages || 0} total={list.data?.total} onPage={setPage} />
        </>
      )}

      <Dialog open={formOpen} onOpenChange={(o) => !save.isPending && setFormOpen(o)}>
        <DialogContent className="overflow-y-auto">
          <form onSubmit={onSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit person" : "Add person"}</DialogTitle>
              <DialogDescription>People added here can be picked when you add a movie or web series.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
              <ImagePicker
                label="Photo"
                hint="Square photo works best"
                aspect="square"
                value={editing?.profileImage?.url}
                file={photo}
                onChange={setPhoto}
              />
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cc-name">Name *</Label>
                  <Input id="cc-name" value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Full name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Role *</Label>
                  <Select value={personRole} onValueChange={setPersonRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cc-char">Character name</Label>
                  <Input id="cc-char" value={characterName} onChange={(e) => setCharacterName(e.target.value)} placeholder="Only for actors (optional)" />
                </div>
              </div>
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={save.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {editing ? "Save changes" : "Add person"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete ${toDelete?.personName}?`}
        description="This person and their photo will be removed from the Cast & Crew list. This cannot be undone."
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete._id)}
        onOpenChange={(o) => !o && !remove.isPending && setToDelete(null)}
      />
    </div>
  );
}
