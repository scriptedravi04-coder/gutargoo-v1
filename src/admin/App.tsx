import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import MoviesList from "@/pages/movies/MoviesList";
import MovieForm from "@/pages/movies/MovieForm";
import SeriesList from "@/pages/series/SeriesList";
import SeriesForm from "@/pages/series/SeriesForm";
import Categories from "@/pages/Categories";
import CastCrew from "@/pages/CastCrew";
import HomeBanners from "@/pages/HomeBanners";
import HomeSections from "@/pages/HomeSections";
import HomeSettings from "@/pages/HomeSettings";
import Users from "@/pages/Users";
import RedeemCode from "@/pages/RedeemCode";
import Vendors from "@/pages/Vendors";
import Subscriptions from "@/pages/Subscriptions";
import AdsManager from "@/pages/AdsManager";
import Popups from "@/pages/Popups";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } },
});

// The admin panel lives under /admin (same app as the public website)
const AdminApp = () => {
  useEffect(() => {
    document.title = "Gutargoo+ Admin";
    document.body.style.background = "";
  }, []);
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner richColors position="top-right" />
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />

                    <Route path="/movies" element={<MoviesList />} />
                    <Route path="/movies/new" element={<MovieForm />} />
                    <Route path="/movies/:id/edit" element={<MovieForm />} />

                    <Route path="/web-series" element={<SeriesList contentType="webseries" />} />
                    <Route path="/web-series/new" element={<SeriesForm contentType="webseries" />} />
                    <Route path="/web-series/:id/edit" element={<SeriesForm contentType="webseries" />} />
                    <Route path="/tv-shows" element={<SeriesList contentType="tvshow" />} />
                    <Route path="/tv-shows/new" element={<SeriesForm contentType="tvshow" />} />
                    <Route path="/tv-shows/:id/edit" element={<SeriesForm contentType="tvshow" />} />

                    <Route path="/categories" element={<Categories />} />
                    <Route path="/cast-crew" element={<CastCrew />} />

                    <Route path="/home/banners" element={<HomeBanners />} />
                    <Route path="/home/sections" element={<HomeSections />} />
                    <Route path="/home/settings" element={<HomeSettings />} />
                    <Route path="/popups" element={<Popups />} />

                    <Route path="/users" element={<Users />} />
                    <Route path="/redeem-code" element={<RedeemCode />} />
                    <Route path="/vendors" element={<Vendors />} />
                    <Route path="/subscriptions" element={<Subscriptions />} />
                    <Route path="/ads" element={<AdsManager />} />
                    <Route path="/settings" element={<Settings />} />

                    {/* old links */}
                    <Route path="/movies/add" element={<Navigate to="/movies/new" replace />} />
                    <Route path="/web-series/add" element={<Navigate to="/web-series/new" replace />} />
                    <Route path="/tv-shows/add" element={<Navigate to="/tv-shows/new" replace />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AdminLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default AdminApp;
