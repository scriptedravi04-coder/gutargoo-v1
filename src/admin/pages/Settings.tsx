import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertCircle, KeyRound, Loader2, LockKeyhole, Plus, RefreshCw, ServerCog, ShieldCheck, Trash2 } from "lucide-react";
import { api, API_BASE_URL, errorMessage, USER_KEY, TOKEN_KEY } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Admin {
  _id: string;
  name?: string;
  email: string;
  role?: string;
  createdAt?: string;
}

const currentUserId = (): string => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? String(JSON.parse(raw)?.id || "") : "";
  } catch {
    return "";
  }
};

export default function Settings() {
  return (
    <div>
      <PageHeader title="Settings" description="Your password and who can use this admin panel." />
      <div className="grid gap-6 lg:grid-cols-2">
        <ChangePasswordCard />
        <AboutCard />
        <div className="lg:col-span-2">
          <AdminsCard />
        </div>
      </div>
    </div>
  );
}

/* ───────── Change password ───────── */

function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: async () => (await api.post("/auth/change-password", { currentPassword: current, newPassword: next })).data,
    onSuccess: (res) => {
      // old logins stop working after a password change — keep this one with the fresh token
      if (res?.token) localStorage.setItem(TOKEN_KEY, res.token);
      toast.success(res?.message || "Password changed");
      setCurrent("");
      setNext("");
      setConfirm("");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    let msg = "";
    if (!current) msg = "Enter your current password";
    else if (next.length < 8) msg = "New password must be at least 8 characters";
    else if (next !== confirm) msg = "The two new passwords don't match";
    else if (next === current) msg = "New password must be different from the current one";
    setError(msg);
    if (msg) return;
    save.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" /> Change password
        </CardTitle>
        <CardDescription>Change the password you use to log in here.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pw-current">Current password</Label>
            <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-new">New password</Label>
            <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-confirm">Confirm new password</Label>
            <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Change password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ───────── About ───────── */

function AboutCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ServerCog className="h-4 w-4" /> About
        </CardTitle>
        <CardDescription>Technical details, useful when asking for help.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-sm text-muted-foreground">Backend URL</p>
        <p className="break-all rounded-md bg-muted px-3 py-2 font-mono text-sm">{API_BASE_URL}</p>
      </CardContent>
    </Card>
  );
}

/* ───────── Admin accounts ───────── */

function AdminsCard() {
  const qc = useQueryClient();
  const me = useMemo(currentUserId, []);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Admin | null>(null);
  const [resetting, setResetting] = useState<Admin | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admins"],
    queryFn: async () => (await api.get("/auth/admins")).data.data as Admin[],
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/auth/admins/${id}`)).data,
    onSuccess: (res) => {
      toast.success(res?.message || "Admin removed");
      setRemoving(null);
      qc.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const admins = data || [];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" /> Admin accounts
          </CardTitle>
          <CardDescription>Everyone here can log in to this panel and change everything.</CardDescription>
        </div>
        <Button type="button" size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add admin
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="h-7 w-7 text-destructive" />
            <p className="text-sm text-muted-foreground">{errorMessage(error)}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </div>
        ) : admins.length === 0 ? (
          <EmptyState title="No admins found" />
        ) : (
          <ul className="divide-y rounded-lg border">
            {admins.map((a) => {
              const isMe = String(a._id) === me;
              return (
                <li key={a._id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {a.name || "Admin"}
                      {isMe && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">You</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.email}
                      {a.createdAt && ` · added ${format(new Date(a.createdAt), "d MMM yyyy")}`}
                    </p>
                  </div>
                  {!isMe && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button type="button" variant="outline" size="sm" title="Reset password" onClick={() => setResetting(a)}>
                        <LockKeyhole className="h-4 w-4" />
                        <span className="hidden sm:inline">Reset password</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        title="Remove admin"
                        onClick={() => setRemoving(a)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <AddAdminDialog open={adding} onClose={() => setAdding(false)} />
      <ResetPasswordDialog admin={resetting} onClose={() => setResetting(null)} />

      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.name || removing?.email || "admin"}?`}
        description={`${removing?.email || "This person"} will no longer be able to log in to the admin panel.`}
        confirmLabel="Remove"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing._id)}
        onOpenChange={(o) => !o && !remove.isPending && setRemoving(null)}
      />
    </Card>
  );
}

function AddAdminDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const reset = () => {
    setName("");
    setEmail("");
    setPassword("");
    setError("");
  };

  const save = useMutation({
    mutationFn: async () => (await api.post("/auth/admins", { name: name.trim(), email: email.trim(), password })).data,
    onSuccess: (res) => {
      toast.success(res?.message || "Admin created");
      qc.invalidateQueries({ queryKey: ["admins"] });
      reset();
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    let msg = "";
    if (!name.trim()) msg = "Enter a name";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) msg = "Enter a valid email address";
    else if (password.length < 8) msg = "Password must be at least 8 characters";
    setError(msg);
    if (msg) return;
    save.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !save.isPending) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add admin</DialogTitle>
          <DialogDescription>They can log in with this email and password. Share the password with them safely.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ad-name">Name</Label>
            <Input id="ad-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad-email">Email</Label>
            <Input id="ad-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad-pass">Password</Label>
            <Input id="ad-pass" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={save.isPending}
              onClick={() => {
                reset();
                onClose();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Add admin
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ admin, onClose }: { admin: Admin | null; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const close = () => {
    setPassword("");
    setConfirm("");
    setError("");
    onClose();
  };

  const save = useMutation({
    mutationFn: async () => (await api.post(`/auth/admins/${admin?._id}/reset-password`, { password })).data,
    onSuccess: (res) => {
      toast.success(res?.message || "Password reset");
      close();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    let msg = "";
    if (password.length < 8) msg = "Password must be at least 8 characters";
    else if (password !== confirm) msg = "The two passwords don't match";
    setError(msg);
    if (msg) return;
    save.mutate();
  };

  return (
    <Dialog open={!!admin} onOpenChange={(o) => !o && !save.isPending && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for {admin?.name || "this admin"} ({admin?.email}). Share it with them safely.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rp-new">New password</Label>
            <Input id="rp-new" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rp-confirm">Confirm new password</Label>
            <Input id="rp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={save.isPending} onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
