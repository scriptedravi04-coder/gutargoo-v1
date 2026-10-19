import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, GripVertical, Info, LayoutList, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { HomeSection, SOURCE_LABELS, STYLE_LABELS, SectionFormSheet } from "@/components/home/SectionFormSheet";

const KEY = ["sections"];

const itemsLabel = (s: HomeSection): { text: string; warn: boolean } => {
  const count = (s.sectionData?.movies?.length || 0) + (s.sectionData?.webseries?.length || 0);
  if (s.contentSource === "admin_selected") {
    return count ? { text: `${count} item${count === 1 ? "" : "s"}`, warn: false } : { text: "No items – hidden in app", warn: true };
  }
  if (s.contentSource === "auto" && count) return { text: `${count} item${count === 1 ? "" : "s"}`, warn: false };
  return { text: "Automatic", warn: false };
};

export default function HomeSections() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HomeSection | null>(null);
  const [toDelete, setToDelete] = useState<HomeSection | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const data = ((await api.get("/admin/sections")).data.data || []) as HomeSection[];
      return [...data].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    },
  });
  const sections = list.data || [];

  const reorder = useMutation({
    mutationFn: async (ordered: HomeSection[]) => (await api.put("/admin/sections/reorder", { ids: ordered.map((s) => s._id) })).data,
    onMutate: async (ordered) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<HomeSection[]>(KEY);
      qc.setQueryData(KEY, ordered);
      return { previous };
    },
    onSuccess: (data) => toast.success(data?.message || "Order saved"),
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(KEY, ctx.previous);
      toast.error(`Order not saved: ${errorMessage(err)}`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const toggle = useMutation({
    mutationFn: async (id: string) => (await api.patch(`/admin/sections/${id}/toggle`)).data,
    onMutate: (id) => setTogglingId(id),
    onSuccess: (data) => {
      toast.success(data?.message || "Saved");
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => setTogglingId(null),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/admin/sections/${id}`)).data,
    onSuccess: (data) => {
      toast.success(data?.message || "Section deleted");
      qc.invalidateQueries({ queryKey: KEY });
      setToDelete(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((s) => s._id === active.id);
    const to = sections.findIndex((s) => s._id === over.id);
    if (from < 0 || to < 0) return;
    reorder.mutate(arrayMove(sections, from, to));
  };

  const move = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= sections.length) return;
    reorder.mutate(arrayMove(sections, index, to));
  };

  const openForm = (s: HomeSection | null) => {
    setEditing(s);
    setFormOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Home Sections"
        description="Build the rows of the app's home screen. Drag rows (or use the arrows) to change their order."
        actions={
          <Button type="button" onClick={() => openForm(null)}>
            <Plus className="h-4 w-4 mr-1" /> Add section
          </Button>
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Changes show in the app the next time users open the home screen. Empty sections are hidden in the app.</p>
      </div>

      {list.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : list.isError ? (
        <EmptyState
          title="Could not load sections"
          description={errorMessage(list.error)}
          action={
            <Button type="button" variant="outline" onClick={() => list.refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Retry
            </Button>
          }
        />
      ) : sections.length === 0 ? (
        <EmptyState
          icon={<LayoutList className="h-8 w-8" />}
          title="No sections yet"
          description="Add your first row, like “Trending now” or “New releases”."
          action={
            <Button type="button" onClick={() => openForm(null)}>
              <Plus className="h-4 w-4 mr-1" /> Add section
            </Button>
          }
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={sections.map((s) => s._id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {sections.map((s, i) => (
                <SectionRow
                  key={s._id}
                  section={s}
                  index={i}
                  isFirst={i === 0}
                  isLast={i === sections.length - 1}
                  busyOrder={reorder.isPending}
                  toggling={togglingId === s._id}
                  onMove={(dir) => move(i, dir)}
                  onToggle={() => toggle.mutate(s._id)}
                  onEdit={() => openForm(s)}
                  onDelete={() => setToDelete(s)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <SectionFormSheet open={formOpen} onOpenChange={setFormOpen} section={editing} />

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete section "${toDelete?.title}"?`}
        description="This row will be removed from the app's home screen. The movies and series in it are not deleted."
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete._id)}
        onOpenChange={(o) => !o && !remove.isPending && setToDelete(null)}
      />
    </div>
  );
}

interface RowProps {
  section: HomeSection;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  busyOrder: boolean;
  toggling: boolean;
  onMove: (dir: -1 | 1) => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SectionRow({ section: s, index, isFirst, isLast, busyOrder, toggling, onMove, onToggle, onEdit, onDelete }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: s._id, disabled: busyOrder });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const items = itemsLabel(s);
  // older sections may have no isActive value — the app shows those (only false hides a row)
  const active = s.isActive !== false;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn("flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center", isDragging && "relative z-10 shadow-lg opacity-90", !active && "opacity-70")}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          aria-label={`Drag to reorder ${s.title}`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">#{index + 1}</span>
            <p className="truncate font-medium">{s.title}</p>
            {active ? <StatusPill tone="ok">Shown</StatusPill> : <StatusPill tone="none">Hidden</StatusPill>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant="secondary" className="font-normal">
              {SOURCE_LABELS[s.contentSource] || s.contentSource}
            </Badge>
            <Badge variant="outline" className="font-normal">
              {STYLE_LABELS[s.displayStyle] || s.displayStyle}
            </Badge>
            {s.categoryId?.name && (
              <Badge variant="outline" className="font-normal">
                {s.categoryId.name}
              </Badge>
            )}
            <span className={cn("text-muted-foreground", items.warn && "text-amber-600")}>{items.text}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={active} disabled={toggling} onCheckedChange={onToggle} aria-label="Show in app" />
          Show
        </label>
        <div className="flex items-center">
          <Button type="button" variant="ghost" size="icon" disabled={isFirst || busyOrder} onClick={() => onMove(-1)} aria-label="Move up">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" disabled={isLast || busyOrder} onClick={() => onMove(1)} aria-label="Move down">
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={onEdit} aria-label="Edit section">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={onDelete} aria-label="Delete section">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </li>
  );
}
