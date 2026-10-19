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
          <BrowserRouter>
            <ScrollManager />
            <SpatialNav />
            <Splash />
            <ErrorBoundary>
            <Suspense fallback={<FullPageSpinner />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/section/:id" element={<ViewAll />} />
                <Route path="/movie/:id" element={<MovieDetail />} />
                <Route path="/series/:id" element={<SeriesDetail />} />
                {/* /watch/movie/:id  or  /watch/series/:id?ep=<episodeId>  (optional &t=seconds to resume) */}
                <Route path="/watch/:kind/:id" element={<Watch />} />
                <Route path="/search" element={<Search />} />
                <Route path="/watchlist" element={<Watchlist />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/account" element={<Account />} />
                <Route path="/help" element={<Help />} />
                <Route path="/privacy-policy" element={<Privacy />} />
                <Route path="/login" element={<Login />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </ErrorBoundary>
            <InstallBanner />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
    </div>
  );
}
