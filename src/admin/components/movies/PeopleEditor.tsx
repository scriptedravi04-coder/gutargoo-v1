import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookUser, Loader2, Plus, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { api, errorMessage } from "@/lib/api";
import { newPerson, Person } from "./movieFormModel";
import { compressImage } from "@/lib/imageCompress";

interface DirectoryPerson {
  _id: string;
  personName: string;
  role?: string;
  characterName?: string;
  profileImage?: { url?: string; publicId?: string } | string;
}

const MAX_MB = 20;
const imageOf = (p: DirectoryPerson) => (typeof p.profileImage === "string" ? p.profileImage : p.profileImage?.url || "");

// ───────── Small photo picker for one person ─────────
function PersonPhoto({ person, onChange }: { person: Person; onChange: (patch: Partial<Person>) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(person.imageUrl);
  // latest onChange (it closes over the current list) for the async photo shrink below
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!person.file) {
      setPreview(person.imageUrl);
      return;
    }
    const url = URL.createObjectURL(person.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [person.file, person.imageUrl]);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-dashed bg-muted/40 hover:border-primary/60"
        title="Choose photo"
      >
        {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-6 w-6 text-muted-foreground" />}
      </button>
      {preview && (
        <button
          type="button"
          onClick={() => onChange(person.file ? { file: null } : { imageUrl: "", publicId: "" })}
          className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white"
          title={person.file ? "Undo new photo" : "Remove photo"}
          aria-label={person.file ? "Undo new photo" : "Remove photo"}
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > MAX_MB * 4 * 1024 * 1024) {
            toast.error(`Photo is larger than ${MAX_MB * 4} MB`);
            return;
          }
          void compressImage(f).then((out) => {
            if (out.size > MAX_MB * 1024 * 1024) toast.error(`Photo is larger than ${MAX_MB} MB`);
            else onChangeRef.current({ file: out });
          });
        }}
      />
    </div>
  );
}

// ───────── "Pick from Cast & Crew directory" ─────────
function DirectoryPicker({ roleLabel, onPick }: { roleLabel: string; onPick: (p: DirectoryPerson) => void }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["castAndCrew", "all"],
    queryFn: async () => (await api.get("/castAndCrew/getAll")).data.data as DirectoryPerson[],
    enabled: open,
    staleTime: Infinity,
  });

  const list = data || [];
  const matching = list.filter((p) => p.role === roleLabel);
  const others = list.filter((p) => p.role !== roleLabel);

  const renderItem = (p: DirectoryPerson) => (
    <CommandItem
      key={p._id}
      value={`${p.personName} ${p.role || ""} ${p._id}`}
      onSelect={() => {
        onPick(p);
        setOpen(false);
      }}
      className="gap-2"
    >
      {imageOf(p) ? (
        <img src={imageOf(p)} alt="" className="h-7 w-7 rounded-full object-cover" />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
          <UserRound className="h-4 w-4 text-muted-foreground" />
        </span>
      )}
      <span className="flex-1 truncate">{p.personName}</span>
      {p.role && <span className="text-xs text-muted-foreground">{p.role}</span>}
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <BookUser className="mr-1 h-4 w-4" /> Pick from Cast &amp; Crew
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading people…
          </div>
        ) : isError ? (
          <div className="space-y-2 p-4 text-sm">
            <p className="text-destructive">{errorMessage(error)}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <Command>
            <CommandInput placeholder="Search by name…" />
            <CommandList>
              <CommandEmpty>No one found. Add people on the Cast &amp; Crew page.</CommandEmpty>
              {matching.length > 0 && <CommandGroup heading={roleLabel}>{matching.map(renderItem)}</CommandGroup>}
              {others.length > 0 && <CommandGroup heading={matching.length ? "Everyone else" : "Everyone"}>{others.map(renderItem)}</CommandGroup>}
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ───────── Editor for one role ─────────
interface Props {
  id: string; // DOM id (for scrolling to errors)
  title: string;
  roleLabel: string; // role name used in the Cast & Crew directory ("Director", "Actor"…)
  withCharacter?: boolean;
  people: Person[];
  onChange: (people: Person[]) => void;
  error?: string;
}

export function PeopleEditor({ id, title, roleLabel, withCharacter, people, onChange, error }: Props) {
  const update = (key: string, patch: Partial<Person>) => onChange(people.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const remove = (key: string) => onChange(people.filter((p) => p.key !== key));

  const pick = (d: DirectoryPerson) => {
    const person = newPerson({
      name: d.personName,
      character: withCharacter ? d.characterName || "" : "",
      imageUrl: imageOf(d),
      publicId: typeof d.profileImage === "object" && d.profileImage ? d.profileImage.publicId || "" : "",
    });
    // Fill the last row if it is still empty, otherwise add a new row
    const lastRow = people[people.length - 1];
    if (lastRow && !lastRow.name.trim() && !lastRow.file && !lastRow.imageUrl) onChange([...people.slice(0, -1), person]);
    else onChange([...people, person]);
  };

  return (
    <div id={id} className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">
          {title} <span className="text-muted-foreground font-normal">({people.length})</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <DirectoryPicker roleLabel={roleLabel} onPick={pick} />
          <Button type="button" size="sm" variant="secondary" onClick={() => onChange([...people, newPerson()])}>
            <Plus className="mr-1 h-4 w-4" /> Add person
          </Button>
        </div>
      </div>

      {people.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nobody added yet.</p>
      ) : (
        <div className="space-y-2">
          {people.map((p) => (
            <div key={p.key} className="flex items-center gap-3">
              <PersonPhoto person={p} onChange={(patch) => update(p.key, patch)} />
              <div className={withCharacter ? "grid flex-1 gap-2 sm:grid-cols-2" : "flex-1"}>
                <Input value={p.name} onChange={(e) => update(p.key, { name: e.target.value })} placeholder="Full name" />
                {withCharacter && (
                  <Input value={p.character} onChange={(e) => update(p.key, { character: e.target.value })} placeholder="Character name (optional)" />
                )}
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={() => remove(p.key)} aria-label="Remove person">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
