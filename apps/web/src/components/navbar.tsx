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
  Search,
  LayoutDashboard,
  ShieldAlert,
  Building2,
  User as UserIcon,
  ChevronDown,
} from "lucide-react";
import { CommandPalette } from "./command-palette";

export function Navbar() {
  const pathname = usePathname();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeContext, setActiveContext] = useState<"personal" | "org">("personal");
  const [isContextOpen, setIsContextOpen] = useState(false);

  const navLinks = [
    { href: "/explore", label: "Explore", icon: Compass },
    { href: "/market", label: "Market", icon: ShoppingBag },
    { href: "/servers", label: "Servers", icon: Server },
    { href: "/developers", label: "Developers", icon: Code2 },
    { href: "/articles", label: "Articles", icon: BookOpen },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-[#232838] bg-[#090a0f]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-6">
            <Link href="/" className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-base shadow-lg shadow-blue-500/20">
                NX
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold tracking-wider text-white text-sm">
                  MTA <span className="text-blue-500">NEXUS</span>
                </span>
                <span className="text-[10px] text-neutral-400 -mt-1 font-mono">1.0 ECOSYSTEM</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-neutral-800 text-white font-semibold"
                        : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Quick Search */}
          <div className="flex-1 max-w-md hidden sm:block">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-lg bg-[#11131a] border border-[#232838] text-neutral-400 text-xs hover:border-neutral-600 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-neutral-500" />
                <span>Search scripts, servers, tutorials...</span>
              </div>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-neutral-800 text-neutral-400 rounded border border-neutral-700">
                Ctrl K
              </kbd>
            </button>
          </div>

          {/* User & Context Switching Area */}
          <div className="flex items-center space-x-2.5">
            {/* Context Switcher */}
            <div className="relative hidden lg:block">
              <button
                onClick={() => setIsContextOpen(!isContextOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-[#232838] text-xs text-neutral-300 hover:border-neutral-700"
              >
                {activeContext === "personal" ? (
                  <>
                    <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span>Personal</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Horizon Studio</span>
                  </>
                )}
                <ChevronDown className="w-3 h-3 text-neutral-500" />
              </button>

              {isContextOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg bg-[#11131a] border border-[#232838] shadow-xl py-1 text-xs z-50">
                  <div className="px-3 py-1.5 text-[10px] text-neutral-500 uppercase font-semibold">
                    Switch Workspace Context
                  </div>
                  <button
                    onClick={() => {
                      setActiveContext("personal");
                      setIsContextOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-neutral-800 text-neutral-200"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                    <div>
                      <div className="font-medium">Personal Account</div>
                      <div className="text-[10px] text-neutral-500">Purchases & Saved</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setActiveContext("org");
                      setIsContextOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-neutral-800 text-neutral-200"
                  >
                    <Building2 className="w-3.5 h-3.5 text-amber-400" />
                    <div>
                      <div className="font-medium">Horizon Studio</div>
                      <div className="text-[10px] text-neutral-500">Organization & Team</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Workspace Link */}
            <Link
              href="/workspace"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-xs font-medium text-neutral-200 border border-[#232838] transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Workspace</span>
            </Link>

            {/* Admin Link */}
            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-xs font-medium text-red-400 border border-[#232838] transition-colors"
              title="Admin Control Center"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </Link>

            {/* Sign In Link */}
            <Link
              href="/auth/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-sm transition-colors"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
          </div>
        </div>
      </header>

      <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
