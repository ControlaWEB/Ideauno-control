"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { useAuthStore } from "@/store/auth.store";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { AdvisorDashboard } from "@/components/dashboard/advisor-dashboard";
import { AdvisorDashboardSelector } from "@/components/dashboard/advisor-dashboard-selector";
import { AccessDenied } from "@/components/access-guard";

type View = "admin" | "mi-dashboard";
const ADMIN_ROLES = ["Super Admin", "Admin"];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [view, setView] = useState<View>("admin");
  const isAdmin = ADMIN_ROLES.includes(user?.role ?? "");

  if (user?.role === "Asesor") {
    return (
      <>
        <Header />
        <AdvisorDashboard />
      </>
    );
  }

  if (!isAdmin) {
    return <AccessDenied title="Dashboard" />;
  }

  const VIEWS: { id: View; label: string }[] = [
    { id: "admin", label: "Dashboard Administrativo" },
    { id: "mi-dashboard", label: "Mi Dashboard" },
  ];

  return (
    <>
      <Header />
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "10px 24px 0",
          background: "var(--color-surface-container-lowest)",
          borderBottom: "1px solid var(--color-outline-variant)",
        }}
      >
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
              background: "none",
              border: "none",
              cursor: "pointer",
              borderBottom:
                view === v.id
                  ? "2px solid var(--color-primary)"
                  : "2px solid transparent",
              color:
                view === v.id
                  ? "var(--color-primary)"
                  : "var(--color-on-surface-variant)",
              marginBottom: -1,
              transition: "all 0.15s",
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "admin" ? <AdminDashboard /> : <AdvisorDashboardSelector />}
    </>
  );
}
