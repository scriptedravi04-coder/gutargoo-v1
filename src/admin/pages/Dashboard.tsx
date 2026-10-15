import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertCircle,
  Crown,
  Eye,
  Film,
  Gift,
  Image as ImageIcon,
  Info,
  LayoutList,
  MonitorPlay,
  Plus,
  RefreshCw,
  Tv,
  UserPlus,
  Users as UsersIcon,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { EmptyState } from "@/components/common/EmptyState";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Stats {
  users: { total: number; today: number; last7Days: number; premium: number; blocked: number };
  content: {
    movies: number;
    moviesPublished: number;
    moviesProcessing: number;
    webSeries: number;
    tvShows: number;
    episodes: number;
    banners: number;
    sections: number;
  };
  activeRedeemCodes: number;
  totalViews: number;
  watchedLast24h: number;
  topMovies: { _id: string; title: string; views: number; posterUrl: string }[];
  recentMovies: { _id: string; title: string; createdAt: string; publishStatus: boolean; videoStatus: number | null; posterUrl: string }[];
  signups: { date: string; count: number }[];
}

const n = (v: number) => (v || 0).toLocaleString("en-IN");

const videoPill = (status: number | null) => {
  if (status === null || status === undefined) return <StatusPill tone="none">No video</StatusPill>;
  if (status === 4) return <StatusPill tone="ok">Ready</StatusPill>;
  if (status === 5 || status === 6) return <StatusPill tone="bad">Failed</StatusPill>;
  return <StatusPill tone="wait">Processing</StatusPill>;
};

const safeDate = (d: string, f: string) => {
  try {
    return format(typeof d === "string" && d.length === 10 ? parseISO(d) : new Date(d), f);
  } catch {
    return d;
  }
};

function Poster({ url }: { url: string }) {
  return url ? (
    <img src={url} alt="" className="h-14 w-10 shrink-0 rounded object-cover bg-muted" loading="lazy" />
  ) : (
    <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
      <Film className="h-4 w-4" />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-14 w-10" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => (await api.get("/admin/stats")).data.data as Stats,
  });

  const quickActions = (
    <>
      <Button asChild size="sm">
        <Link to="/movies/new">
          <Plus className="h-4 w-4" /> Add movie
        </Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link to="/web-series/new">
          <Plus className="h-4 w-4" /> Add web series
        </Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link to="/home/banners">
          <ImageIcon className="h-4 w-4" /> Add banner
        </Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link to="/home/sections">
          <LayoutList className="h-4 w-4" /> Section builder
        </Link>
      </Button>
    </>
  );

  if (isError) {
    return (
      <div>
        <PageHeader title="Dashboard" description="A quick look at your app." actions={quickActions} />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="font-medium">Could not load the dashboard</p>
            <p className="text-sm text-muted-foreground">{errorMessage(error)}</p>
            <Button type="button" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = data;
  const loading = isLoading || !s;
  const signupTotal = s ? s.signups.reduce((a, b) => a + b.count, 0) : 0;
  const chartData = s ? s.signups.map((d) => ({ ...d, label: safeDate(d.date, "d MMM") })) : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="A quick look at your app." actions={quickActions} />

      {s && s.content.moviesProcessing > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p>
            <strong>{s.content.moviesProcessing}</strong> {s.content.moviesProcessing === 1 ? "movie video is" : "movie videos are"} still being
            processed by Bunny. They will play in the app once ready (usually a few minutes). Status refreshes automatically.
          </p>
        </div>
      )}

      {/* Users */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
        <StatCard
          title="Total users"
          value={s?.users.total}
          icon={<UsersIcon />}
          hint={s && `${n(s.users.blocked)} blocked`}
          to="/users"
          loading={loading}
        />
        <StatCard
          title="New users"
          value={s?.users.today}
          icon={<UserPlus />}
          hint={s && `Today · ${n(s.users.last7Days)} in last 7 days`}
          loading={loading}
        />
        <StatCard title="Premium users" value={s?.users.premium} icon={<Crown />} hint="Premium or active subscription" loading={loading} />
        <StatCard
          title="Total views"
          value={s?.totalViews}
          icon={<Eye />}
          hint={s && `${n(s.watchedLast24h)} watched something in last 24h`}
          loading={loading}
        />
      </div>

      {/* Content */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
        <StatCard
          title="Movies"
          value={s?.content.movies}
          icon={<Film />}
          hint={s && `${n(s.content.moviesPublished)} published`}
          to="/movies"
          loading={loading}
        />
        <StatCard
          title="Web series"
          value={s?.content.webSeries}
          icon={<MonitorPlay />}
          hint={s && `${n(s.content.episodes)} episodes (series + TV)`}
          to="/web-series"
          loading={loading}
        />
        <StatCard title="TV shows" value={s?.content.tvShows} icon={<Tv />} to="/tv-shows" loading={loading} />
        <StatCard
          title="Active redeem codes"
          value={s?.activeRedeemCodes}
          icon={<Gift />}
          hint={s && `${n(s.content.banners)} live banners · ${n(s.content.sections)} active sections`}
          to="/redeem-code"
          loading={loading}
        />
      </div>

      {/* Signups chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">New users – last 14 days</CardTitle>
          <CardDescription>{s ? `${n(signupTotal)} sign-ups in total` : " "}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [value, "New users"]}
                    labelFormatter={(label: string) => label}
                  />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#signupFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top movies */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top 5 movies</CardTitle>
            <CardDescription>By number of views</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ListSkeleton />
            ) : s.topMovies.length === 0 ? (
              <EmptyState icon={<Film className="h-6 w-6" />} title="No movies yet" />
            ) : (
              <ol className="space-y-3">
                {s.topMovies.map((m, i) => (
                  <li key={m._id}>
                    <Link to={`/movies/${m._id}/edit`} className="flex items-center gap-3 rounded-md p-1 -m-1 hover:bg-muted/60">
                      <span className="w-5 text-center text-sm font-semibold text-muted-foreground">{i + 1}</span>
                      <Poster url={m.posterUrl} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.title}</span>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        <Eye className="mr-1 inline h-3.5 w-3.5" />
                        {n(m.views)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Recent movies */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recently added movies</CardTitle>
            <CardDescription>Click a movie to edit it</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ListSkeleton />
            ) : s.recentMovies.length === 0 ? (
              <EmptyState
                icon={<Film className="h-6 w-6" />}
                title="No movies yet"
                action={
                  <Button asChild size="sm">
                    <Link to="/movies/new">
                      <Plus className="h-4 w-4" /> Add movie
                    </Link>
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-3">
                {s.recentMovies.map((m) => (
                  <li key={m._id}>
                    <Link to={`/movies/${m._id}/edit`} className="flex items-center gap-3 rounded-md p-1 -m-1 hover:bg-muted/60">
                      <Poster url={m.posterUrl} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{m.title}</p>
                        <p className="text-xs text-muted-foreground">Added {safeDate(m.createdAt, "d MMM yyyy")}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {videoPill(m.videoStatus)}
                        {m.publishStatus ? <StatusPill tone="ok">Published</StatusPill> : <StatusPill tone="none">Draft</StatusPill>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
