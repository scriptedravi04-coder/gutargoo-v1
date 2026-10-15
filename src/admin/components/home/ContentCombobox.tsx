import { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { DraftBadge, PickedItem, Poster } from "./contentOptions";

interface Props {
  items: PickedItem[];
  value: string; // selected _id or ""
  onChange: (id: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  loading?: boolean;
  /** Shown when the selected id is not in `items` (e.g. list still loading). */
  fallbackLabel?: string;
}

/** Searchable single-choice list (long lists of movies / series). */
export function ContentCombobox({ items, value, onChange, placeholder, searchPlaceholder, emptyText, loading, fallbackLabel }: Props) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i._id === value);
  const label = selected ? selected.title : value && fallbackLabel ? fallbackLabel : "";

  return (
    // modal keeps scrolling working when this is used inside a dialog
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className={cn("flex min-w-0 items-center gap-2", !label && "text-muted-foreground")}>
            {selected && <Poster url={selected.posterUrl} className="h-6 w-4" />}
            <span className="truncate">{label || placeholder}</span>
          </span>
          {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-60" /> : <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder || "Search…"} />
          <CommandList className="max-h-72">
            <CommandEmpty>{loading ? "Loading…" : emptyText || "Nothing found."}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item._id}
                  value={`${item.title} ${item.subtitle || ""} ${item._id}`}
                  onSelect={() => {
                    onChange(item._id);
                    setOpen(false);
                  }}
                  className="gap-2"
                >
                  <Check className={cn("h-4 w-4 shrink-0", item._id === value ? "opacity-100" : "opacity-0")} />
                  <Poster url={item.posterUrl} className="h-9 w-6" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{item.title}</p>
                    {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
                  </div>
                  {!item.published && <DraftBadge />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
