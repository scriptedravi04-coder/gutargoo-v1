import { FormEvent, useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { toast } from "sonner";
import { AlertCircle, Coins, Loader2, RefreshCw, Search, Users as UsersIcon } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { Pager } from "@/components/common/Pager";
import { StatusPill } from "@/components/common/StatusPill";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AppUser {
  _id: string;
  mobile: string;
  name?: string;
  createdAt?: string;
  lastLogin?: string;
  isBlocked?: boolean;
  isPremium?: boolean; // premium forever OR active subscription
  isPremiusm?: boolean; // premium forever (raw field)
  subscriptionExpiry?: string | null;
  subscriptionActive?: boolean;
  coins?: number;
}

type Filter = "all" | "premium" | "blocked";

const LIMIT = 50;

/** 91XXXXXXXXXX → +91 XXXXX XXXXX */
const formatMobile = (m?: string) => {
  const d = String(m || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  if (d.length === 10) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  return m || "–";
};

const fmtDate = (d?: string | null, withTime = false) => {
  if (!d) return "–";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "–";
  return format(date, withTime ? "d MMM yyyy, h:mm a" : "d MMM yyyy");
};

function useDebounced<T>(value: T, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function PlanBadge({ u }: { u: AppUser }) {
  if (u.isPremiusm) return <StatusPill tone="ok">Premium (forever)</StatusPill>;
  if (u.subscriptionActive) return <StatusPill tone="ok">Subscribed till {fmtDate(u.subscriptionExpiry)}</StatusPill>;
  if (u.subscriptionExpiry) return <StatusPill tone="bad">Expired {fmtDate(u.subscriptionExpiry)}</StatusPill>;
  return <StatusPill tone="none">Free</StatusPill>;
}

export default function Users() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AppUser | null>(null);
  // "+91 98765 43210" / "098765 43210" → "9876543210" (stored numbers are 10 digits)
  const searchDigits = (() => {
    const d = search.replace(/\D/g, "");
    return d.length > 10 ? d.replace(/^(91|0)/, "") : d;
  })();
  const debounced = useDebounced(searchDigits);

  useEffect(() => setPage(1), [debounced, filter]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["customers", page, debounced, filter],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: LIMIT };
      if (debounced) params.search = debounced;
      if (filter !== "all") params.filter = filter;
      const res = await api.get("/admin/customers", { params });
      return res.data as { data: AppUser[]; total: number; totalPages: number };
    },
    placeholderData: keepPreviousData,
  });

  const users = data?.data || [];

  return (
    <div>
      <PageHeader title="App users" description="People who signed up in the app with their mobile number." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="premium">Premium</TabsTrigger>
            <TabsTrigger value="blocked">Blocked</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by mobile number"
            inputMode="numeric"
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="font-medium">Could not load users</p>
            <p className="text-sm text-muted-foreground">{errorMessage(error)}</p>
            <Button type="button" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : users.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-8 w-8" />}
          title={debounced || filter !== "all" ? "No users match" : "No users yet"}
          description={debounced || filter !== "all" ? "Try another number or filter." : "Users appear here after they sign up in the app."}
        />
      ) : (
        <>
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Last login</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Coins</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u._id}>
                      <TableCell className="whitespace-nowrap font-medium">{formatMobile(u.mobile)}</TableCell>
                      <TableCell className="max-w-[160px] truncate">{u.name || <span className="text-muted-foreground">–</span>}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{fmtDate(u.createdAt)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{fmtDate(u.lastLogin, true)}</TableCell>
                      <TableCell>
                        <PlanBadge u={u} />
                      </TableCell>
                      <TableCell className="text-right">{(u.coins || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell>{u.isBlocked ? <StatusPill tone="bad">Blocked</StatusPill> : <StatusPill tone="none">Active</StatusPill>}</TableCell>
                      <TableCell className="text-right">
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(u)}>
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
          <Pager page={page} totalPages={data?.totalPages || 1} total={data?.total} onPage={setPage} />
        </>
      )}

      <ManageUserDialog user={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function ManageUserDialog({ user, onClose }: { user: AppUser | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [coins, setCoins] = useState("0");
  const [addDaysCount, setAddDaysCount] = useState(0);
  const [customDays, setCustomDays] = useState("");
  const [removeSub, setRemoveSub] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name || "");
    setIsBlocked(!!user.isBlocked);
    setIsPremium(!!user.isPremiusm);
    setCoins(String(user.coins || 0));
    setAddDaysCount(0);
    setCustomDays("");
    setRemoveSub(false);
  }, [user]);

  const save = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await api.patch(`/admin/customers/${user?._id}`, body)).data,
    onSuccess: (res) => {
      toast.success(res?.message || "User updated");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (!user) return null;

  const currentExpiry = user.subscriptionExpiry ? new Date(user.subscriptionExpiry) : null;
  const activeNow = !!(currentExpiry && currentExpiry > new Date());
  const base = activeNow ? currentExpiry : new Date();
  const newExpiry = removeSub ? null : addDaysCount > 0 ? addDays(base, addDaysCount) : currentExpiry;

  const addQuick = (d: number) => {
    setAddDaysCount((x) => x + d);
  };

  const addCustom = () => {
    const d = Math.floor(Number(customDays));
    if (!d || d < 1) {
      toast.error("Enter a number of days (1 or more)");
      return;
    }
    setAddDaysCount((x) => x + d);
    setCustomDays("");
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const c = Number(coins);
    if (coins.trim() === "" || isNaN(c) || c < 0) {
      toast.error("Coins must be 0 or more");
      return;
    }
    const body: Record<string, unknown> = { name: name.trim(), isBlocked, isPremium, coins: Math.floor(c) };
    // the UI never allows "remove" and "add days" together
    if (removeSub) body.subscriptionExpiry = null;
    else if (addDaysCount > 0) body.addSubscriptionDays = addDaysCount;
    save.mutate(body);
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage user</DialogTitle>
          <DialogDescription>
            {formatMobile(user.mobile)} · joined {fmtDate(user.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="u-name">Name</Label>
            <Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="User's name" />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="u-block">Blocked</Label>
              <p className="text-xs text-muted-foreground">Blocked users can't log in to the app.</p>
            </div>
            <Switch id="u-block" checked={isBlocked} onCheckedChange={setIsBlocked} />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="u-premium">Premium forever</Label>
              <p className="text-xs text-muted-foreground">Gives full access with no end date, even without a subscription.</p>
            </div>
            <Switch id="u-premium" checked={isPremium} onCheckedChange={setIsPremium} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="u-coins">Coins</Label>
            <div className="relative">
              <Coins className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="u-coins" type="number" min={0} step={1} value={coins} onChange={(e) => setCoins(e.target.value)} className="pl-9" />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Subscription</p>
              <p className="text-xs text-muted-foreground">
                {activeNow ? (
                  <>Active till {fmtDate(user.subscriptionExpiry)}.</>
                ) : currentExpiry ? (
                  <>Expired on {fmtDate(user.subscriptionExpiry)}.</>
                ) : (
                  <>No subscription.</>
                )}{" "}
                Added days start from the current end date (or today if none).
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {[7, 30, 90, 365].map((d) => (
                <Button key={d} type="button" size="sm" variant="outline" disabled={removeSub} onClick={() => addQuick(d)}>
                  +{d} days
                </Button>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                step={1}
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                onKeyDown={(e) => {
                  // Enter adds the days instead of submitting the whole dialog
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustom();
                  }
                }}
                placeholder="Custom days"
                className="w-36"
                disabled={removeSub}
              />
              <Button type="button" size="sm" variant="secondary" onClick={addCustom} disabled={removeSub} className="h-10">
                Add
              </Button>
            </div>

            {(addDaysCount > 0 || removeSub) && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm">
                <span>
                  {addDaysCount > 0 && <>Adding <strong>{addDaysCount}</strong> days. </>}
                  {newExpiry ? <>New end date: <strong>{format(newExpiry, "d MMM yyyy")}</strong></> : <>Subscription will be removed.</>}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAddDaysCount(0);
                    setRemoveSub(false);
                  }}
                >
                  Undo
                </Button>
              </div>
            )}

            {currentExpiry && !removeSub && addDaysCount === 0 && (
              <Button type="button" size="sm" variant="outline" className="text-destructive" onClick={() => setRemoveSub(true)}>
                Remove subscription
              </Button>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
