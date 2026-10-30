import { Suspense, useEffect } from "react";
import { lazyPage } from "../lazyPage";
import { ErrorBoundary } from "@v/components/ErrorBoundary";
import "./viewer.css";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@v/lib/auth";
import { ToastProvider } from "@v/hooks/useToast";
import { FullPageSpinner } from "@v/components/States";
import Splash from "@v/components/home/Splash";
import { InstallBanner } from "@v/components/InstallPrompt";
import { ScrollManager } from "@v/components/ScrollManager";
import { SpatialNav } from "@v/components/desktop/SpatialNav";
import Home from "@v/pages/Home";
import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useIsDesktop } from "@v/hooks/useIsDesktop";
import { GlobalNav, V3ToastProvider } from "@v/v3/ui";
import HomeV3 from "@v/v3/Home";
import { ProSync } from "@v/v3/ProSync";

// Phones get the v3 mobile UI; laptop / desktop / TV keep the big-screen layout
const PotliV3 = lazyPage(() => import("@v/v3/Potli"));
const DetailV3 = lazyPage(() => import("@v/v3/Detail"));
const WatchV3 = lazyPage(() => import("@v/v3/Watch"));
const SearchV3 = lazyPage(() => import("@v/v3/Search"));
const MyListV3 = lazyPage(() => import("@v/v3/MyList"));
const ProfileV3 = lazyPage(() => import("@v/v3/Profile"));
const LoginV3 = lazyPage(() => import("@v/v3/Login"));
const PlansV3 = lazyPage(() => import("@v/v3/Plans"));
const ViewAllV3 = lazyPage(() => import("@v/v3/ViewAll"));
function GlobalNavMount() {
  return <GlobalNav desktop={useIsDesktop()} />;
}
function Pick({ d, m }: { d: ReactNode; m: ReactNode }) {
  return <>{useIsDesktop() ? d : m}</>;
}

const ViewAll = lazyPage(() => import("@v/pages/ViewAll"));
const MovieDetail = lazyPage(() => import("@v/pages/MovieDetail"));
const SeriesDetail = lazyPage(() => import("@v/pages/SeriesDetail"));
const Watch = lazyPage(() => import("@v/pages/Watch"));
const Search = lazyPage(() => import("@v/pages/Search"));
const Watchlist = lazyPage(() => import("@v/pages/Watchlist"));
const Profile = lazyPage(() => import("@v/pages/Profile"));
const Account = lazyPage(() => import("@v/pages/Account"));
const Help = lazyPage(() => import("@v/pages/Help"));
const Privacy = lazyPage(() => import("@v/pages/Privacy"));
const Login = lazyPage(() => import("@v/pages/Login"));
const NotFound = lazyPage(() => import("@v/pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function ViewerApp() {
  // black page behind the app (also on overscroll)
  useEffect(() => {
    document.body.style.background = "#000";
    document.documentElement.classList.add("gp-viewer"); // lets big TVs scale the whole site
    document.title = "Gutargoo+ — Watch Free Movies & Web Series";
  }, []);
  return (
    <div className="viewer-root">
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <V3ToastProvider>
          <BrowserRouter>
            <ScrollManager />
            <ProSync />
            <SpatialNav />
            <Splash />
            <ErrorBoundary>
            <Suspense fallback={<FullPageSpinner />}>
              <Routes>
                <Route path="/" element={<Pick d={<Home />} m={<HomeV3 />} />} />
                <Route path="/potli" element={<Pick d={<Navigate to="/" replace />} m={<PotliV3 />} />} />
                <Route path="/section/:id" element={<Pick d={<ViewAll />} m={<ViewAllV3 />} />} />
                <Route path="/movie/:id" element={<Pick d={<MovieDetail />} m={<DetailV3 kind="movie" />} />} />
                <Route path="/series/:id" element={<Pick d={<SeriesDetail />} m={<DetailV3 kind="series" />} />} />
                {/* /watch/movie/:id  or  /watch/series/:id?ep=<episodeId>  (optional &t=seconds to resume) */}
                <Route path="/watch/:kind/:id" element={<Pick d={<Watch />} m={<WatchV3 />} />} />
                <Route path="/search" element={<Pick d={<Search />} m={<SearchV3 />} />} />
                <Route path="/watchlist" element={<Pick d={<Watchlist />} m={<MyListV3 />} />} />
                <Route path="/profile" element={<Pick d={<Profile />} m={<ProfileV3 />} />} />
                <Route path="/plans" element={<PlansV3 />} />
                <Route path="/account" element={<Account />} />
                <Route path="/help" element={<Help />} />
                <Route path="/privacy-policy" element={<Privacy />} />
                <Route path="/login" element={<Pick d={<Login />} m={<LoginV3 />} />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </ErrorBoundary>
            <GlobalNavMount />
            <InstallBanner />
          </BrowserRouter>
          </V3ToastProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
    </div>
  );
}
