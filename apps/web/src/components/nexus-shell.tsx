"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { Navbar } from "./navbar";
import { Footer } from "./footer";

export function NexusShell({ children }: { children: React.ReactNode }) {
  // Persist sidebar collapse state across sessions (TASK-005)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("nexus-sidebar-collapsed");
    if (stored === "true") setIsSidebarCollapsed(true);
  }, []);

  const toggle = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("nexus-sidebar-collapsed", String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen flex bg-page text-primary">
      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggle} />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
