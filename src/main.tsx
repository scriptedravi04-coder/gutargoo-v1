// One app, two parts (like Ybex):
//   /admin/*  → admin panel
//   anything else → public website (same look as the mobile app)
import { Suspense } from "react";
import { lazyPage } from "./lazyPage";
import { createRoot } from "react-dom/client";
import "./index.css";
import { registerServiceWorker } from "./pwa";

const isAdmin = window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/");
// website only: makes it installable on phones (admin is never cached)
if (!isAdmin) registerServiceWorker();

const Part = isAdmin ? lazyPage(() => import("./admin/App")) : lazyPage(() => import("./viewer/App"));

createRoot(document.getElementById("root")!).render(
  <Suspense fallback={<div style={{ minHeight: "100vh", background: isAdmin ? "#fafafa" : "#000" }} />}>
    <Part />
  </Suspense>
);
