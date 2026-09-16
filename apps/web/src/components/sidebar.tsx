"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  ShoppingBag,
  Server,
  Code2,
  BookOpen,
  LayoutDashboard,
  Key,
  CreditCard,
  Bookmark,
  Bell,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building2,
  User as UserIcon,
  ShieldAlert,
  DollarSign,
} from "lucide-react";

export function Sidebar({
  isCollapsed,
  onToggle,
}: {
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  const primaryNav = [
    { href: "/explore", label: "Explore", icon: Compass },
    { href: "/market", label: "Market", icon: ShoppingBag },
    { href: "/servers", label: "Servers", icon: Server },
    { href: "/developers", label: "Developers", icon: Code2 },
    { href: "/articles", label: "Articles", icon: BookOpen },
  ];

  const workspaceNav = [
    { href: "/workspace", label: "Overview", icon: LayoutDashboard },
    { href: "/workspace/purchases", label: "Purchases", icon: CreditCard },
    { href: "/workspace/licenses", label: "Licenses", icon: Key },
    { href: "/workspace/sales", label: "Sales", icon: DollarSign },
    { href: "/workspace/saved", label: "Saved", icon: Bookmark },
    { href: "/notifications", label: "Notifications", icon: Bell },
  ];

  return (
    <aside
      className={`hidden lg:flex flex-col border-r border-[#232838] bg-[#0c0e14] transition-all duration-300 z-30 select-none ${
        isCollapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Brand area */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#232838]">
        {!isCollapsed && (
          <Link href="/" className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-xs shadow-md shadow-blue-500/20">
              NX
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold tracking-wider text-white text-xs">
                MTA <span className="text-blue-500">NEXUS</span>
              </span>
              <span className="text-[9px] text-neutral-500 -mt-0.5 font-mono">1.3 TRUST</span>
            </div>
          </Link>
        )}
        {isCollapsed && (
          <Link href="/" className="mx-auto">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-xs shadow-md shadow-blue-500/20">
              NX
            </div>
          </Link>
        )}
        <button
          onClick={onToggle}
          className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex-1 py-4 px-2 space-y-6 overflow-y-auto">
        {/* Main Platform Section */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className="px-3 pb-1 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
              Ecosystem
            </div>
          )}
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white font-semibold shadow-sm"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                } ${isCollapsed ? "justify-center px-0" : ""}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Workspace Section */}
        <div className="space-y-1 pt-2 border-t border-[#1e2230]">
          {!isCollapsed && (
            <div className="px-3 pb-1 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
              Workspace
            </div>
          )}
          {workspaceNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-neutral-800 text-white font-semibold"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                } ${isCollapsed ? "justify-center px-0" : ""}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Admin Section */}
        <div className="space-y-1 pt-2 border-t border-[#1e2230]">
          <Link
            href="/admin"
            title={isCollapsed ? "Admin Control" : undefined}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-neutral-900 transition-colors ${
              pathname.startsWith("/admin") ? "bg-red-950/30 font-semibold" : ""
            } ${isCollapsed ? "justify-center px-0" : ""}`}
          >
            <ShieldAlert className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Admin Control</span>}
          </Link>
        </div>
      </div>
    </aside>
  );
}
