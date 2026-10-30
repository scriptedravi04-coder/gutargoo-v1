import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, Film, Plus, Tv, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DraftBadge, movieToItem, PickedItem, Poster, seriesToItem, useMovieOptions, useSeriesOptions } from "./contentOptions";

interface Props {
  movies: PickedItem[];
  webseries: PickedItem[];
  onMoviesChange: (items: PickedItem[]) => void;
  onWebseriesChange: (items: PickedItem[]) => void;
}

/** Hand-pick movies and series for a home section, and set their order. */
export function SectionContentPicker({ movies, webseries, onMoviesChange, onWebseriesChange }: Props) {
  const [tab, setTab] = useState("movies");
  const movieOpts = useMovieOptions();
  const seriesOpts = useSeriesOptions();
  const movieItems = useMemo(() => (movieOpts.data || []).map(movieToItem), [movieOpts.data]);
  const seriesItems = useMemo(() => (seriesOpts.data || []).map(seriesToItem), [seriesOpts.data]);

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">Content in this row</p>
        <p className="text-xs text-muted-foreground">Tap a title to add or remove it. In the app, picked movies show first, then picked series.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="movies">
            <Film className="h-4 w-4 mr-1.5" /> Movies ({movies.length})
          </TabsTrigger>
          <TabsTrigger value="series">
            <Tv className="h-4 w-4 mr-1.5" /> Web series / TV ({webseries.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="movies" className="space-y-3">
          <OptionList
            options={movieItems}
            picked={movies}
            onChange={onMoviesChange}
            loading={movieOpts.isLoading}
            error={movieOpts.isError ? errorMessage(movieOpts.error) : ""}
            onRetry={() => movieOpts.refetch()}
            searchPlaceholder="Search movies…"
          />
          <PickedList items={movies} onChange={onMoviesChange} emptyText="No movies picked yet." />
        </TabsContent>

        <TabsContent value="series" className="space-y-3">
          <OptionList
            options={seriesItems}
            picked={webseries}
            onChange={onWebseriesChange}
            loading={seriesOpts.isLoading}
            error={seriesOpts.isError ? errorMessage(seriesOpts.error) : ""}
            onRetry={() => seriesOpts.refetch()}
            searchPlaceholder="Search web series and TV shows…"
          />
          <PickedList items={webseries} onChange={onWebseriesChange} emptyText="No series picked yet." />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OptionList({
  options,
  picked,
  onChange,
  loading,
  error,
  onRetry,
  searchPlaceholder,
}: {
  options: PickedItem[];
  picked: PickedItem[];
  onChange: (items: PickedItem[]) => void;
  loading: boolean;
  error: string;
  onRetry: () => void;
  searchPlaceholder: string;
}) {
  const pickedIds = useMemo(() => new Set(picked.map((p) => p._id)), [picked]);

  if (error) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/40 p-2 text-sm text-destructive">
        <span>Could not load the list: {error}</span>
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  const toggle = (item: PickedItem) => {
    if (pickedIds.has(item._id)) onChange(picked.filter((p) => p._id !== item._id));
    else onChange([...picked, item]);
  };

  return (
    <Command className="rounded-md border">
      <CommandInput placeholder={searchPlaceholder} />
      <CommandList className="max-h-56">
        <CommandEmpty>{loading ? "Loading…" : "Nothing found."}</CommandEmpty>
        <CommandGroup>
          {options.map((item) => {
            const on = pickedIds.has(item._id);
            return (
              <CommandItem key={item._id} value={`${item.title} ${item.subtitle || ""} ${item._id}`} onSelect={() => toggle(item)} className="gap-2">
                <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "")}>
                  {on ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3 w-3 opacity-50" />}
                </span>
                <Poster url={item.posterUrl} className="h-9 w-6" />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{item.title}</p>
                  {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
                </div>
                {!item.published && <DraftBadge />}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function PickedList({ items, onChange, emptyText }: { items: PickedItem[]; onChange: (items: PickedItem[]) => void; emptyText: string }) {
  if (!items.length) return <p className="py-2 text-center text-xs text-muted-foreground">{emptyText}</p>;

  const move = (i: number, dir: -1 | 1) => {
    const to = i + dir;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">Picked – shown in this order</p>
      <ol className="space-y-1">
        {items.map((item, i) => (
          <li key={item._id} className="flex items-center gap-2 rounded-md border bg-muted/30 p-1.5">
            <span className="w-5 text-center text-xs text-muted-foreground">{i + 1}</span>
            <Poster url={item.posterUrl} className="h-9 w-6" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{item.title}</p>
              {!item.published && <DraftBadge />}
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onChange(items.filter((p) => p._id !== item._id))} aria-label={`Remove ${item.title}`}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ol>
    </div>
  );
}
