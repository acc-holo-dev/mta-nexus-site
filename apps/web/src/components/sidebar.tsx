"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Library,
  Server,
  Code2,
  BookOpen,
  LayoutDashboard,
  Plus,
  Bookmark,
  Bell,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  BadgeCheck,
  Settings,
  MessageSquare,
} from "lucide-react";

const PRIMARY_NAV = [
  { href: "/servers", label: "Live Servers", icon: Server },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/market", label: "Free Resources", icon: Library },
  { href: "/community", label: "Community", icon: MessageSquare },
  { href: "/articles", label: "Updates", icon: BookOpen },
  { href: "/developers", label: "Creators", icon: Code2 },
];

const WORKSPACE_NAV = [
  { href: "/workspace", label: "Overview", icon: LayoutDashboard },
  { href: "/workspace/resources/new", label: "Publish Resource", icon: Plus },
  { href: "/workspace/servers/new", label: "Register Server", icon: Server },
  { href: "/workspace/saved", label: "Saved", icon: Bookmark },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  isCollapsed,
  onToggle,
}: {
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/workspace"
      ? pathname === "/workspace"
      : pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  return (
    <aside
      className={`hidden lg:flex flex-col border-r border-base bg-surface transition-all duration-200 z-30 select-none shrink-0 ${
        isCollapsed ? "w-14" : "w-56"
      }`}
    >
      {/* Brand */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-base shrink-0">
        {isCollapsed ? (
          <Link href="/" className="mx-auto" aria-label="MTA Nexus home">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center font-black text-white text-xs shadow-nexus-sm">
              NX
            </div>
          </Link>
        ) : (
          <>
            <Link href="/" className="flex items-center space-x-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center font-black text-white text-xs shadow-nexus-sm shrink-0">
                NX
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-heading text-primary leading-tight">
                  MTA <span className="text-accent">NEXUS</span>
                </span>
                <span className="font-caption text-faint leading-tight">Closed beta</span>
              </div>
            </Link>
            <button
              onClick={onToggle}
              className="p-1 rounded-md text-muted hover:text-primary hover:bg-hover transition-colors shrink-0"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-5 overflow-y-auto" aria-label="Main navigation">
        {/* Ecosystem */}
        <div className="space-y-0.5">
          {!isCollapsed && (
            <div className="px-2.5 pb-1.5 font-label text-faint uppercase">Ecosystem</div>
          )}
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? "bg-accent-soft text-accent font-semibold"
                    : "text-secondary hover:text-primary hover:bg-hover"
                } ${isCollapsed ? "justify-center px-0" : ""}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Workspace */}
        <div className="space-y-0.5 pt-3 border-t border-base">
          {!isCollapsed && (
            <div className="px-2.5 pb-1.5 font-label text-faint uppercase">Workspace</div>
          )}
          {WORKSPACE_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? "bg-accent-soft text-accent font-semibold"
                    : "text-secondary hover:text-primary hover:bg-hover"
                } ${isCollapsed ? "justify-center px-0" : ""}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Admin */}
        <div className="space-y-0.5 pt-3 border-t border-base">
          <Link
            href="/admin"
            title={isCollapsed ? "Admin" : undefined}
            aria-current={pathname.startsWith("/admin") ? "page" : undefined}
            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              pathname.startsWith("/admin")
                ? "bg-danger-soft text-danger font-semibold"
                : "text-secondary hover:text-primary hover:bg-hover"
            } ${isCollapsed ? "justify-center px-0" : ""}`}
          >
            <ShieldAlert className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Admin</span>}
          </Link>
        </div>
      </nav>

      {/* Expand button when collapsed */}
      {isCollapsed && (
        <div className="p-2 border-t border-base">
          <button
            onClick={onToggle}
            className="w-full p-1.5 rounded-md text-muted hover:text-primary hover:bg-hover transition-colors flex justify-center"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
