"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Box,
  Server,
  BookOpen,
  User,
  Building2,
  CornerDownLeft,
  LayoutDashboard,
  CreditCard,
  Key,
  Bell,
  Compass,
  ShoppingBag,
} from "lucide-react";
import type { SearchResultItem } from "../lib/services/discovery-service";

interface Command {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  section: string;
}

export function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Navigation commands (TASK-008)
  const commands: Command[] = [
    { id: "go-market", label: "Go to Marketplace", icon: ShoppingBag, section: "Navigate", action: () => router.push("/market") },
    { id: "go-servers", label: "Go to Servers", icon: Server, section: "Navigate", action: () => router.push("/servers") },
    { id: "go-explore", label: "Go to Explore", icon: Compass, section: "Navigate", action: () => router.push("/explore") },
    { id: "go-workspace", label: "Open Workspace", icon: LayoutDashboard, section: "Workspace", action: () => router.push("/workspace") },
    { id: "go-purchases", label: "Open Purchases", icon: CreditCard, section: "Workspace", action: () => router.push("/workspace/purchases") },
    { id: "go-licenses", label: "Open Licenses", icon: Key, section: "Workspace", action: () => router.push("/workspace/licenses") },
    { id: "go-notifications", label: "Open Notifications", icon: Bell, section: "Workspace", action: () => router.push("/notifications") },
  ];

  const filteredCommands = query
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          setQuery("");
          setResults([]);
          setActiveIndex(0);
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const totalItems = filteredCommands.length + results.length;
  const showResults = query.trim().length > 0;

  const handleResultNav = (url: string) => {
    onClose();
    router.push(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-xl bg-elevated border border-strong rounded-xl shadow-nexus-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center px-4 py-3 border-b border-base">
          <Search className="w-4 h-4 text-muted mr-3" />
          <input
            autoFocus
            type="text"
            placeholder="Search or jump to..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, totalItems - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (activeIndex < filteredCommands.length) {
                  filteredCommands[activeIndex]?.action();
                  onClose();
                } else {
                  const r = results[activeIndex - filteredCommands.length];
                  if (r) handleResultNav(r.url);
                }
              }
            }}
            className="w-full bg-transparent text-sm text-primary placeholder-muted focus:outline-none"
            aria-label="Search query"
          />
          <button onClick={onClose} className="text-[10px] px-1.5 py-0.5 bg-inset text-muted rounded border border-base font-numeric">
            ESC
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {/* Loading */}
          {loading && showResults && (
            <div className="text-center py-4 font-caption text-muted">Searching...</div>
          )}

          {/* Commands */}
          {filteredCommands.length > 0 && (
            <div className="mb-1">
              <div className="px-2 py-1 font-label text-faint uppercase">Commands</div>
              {filteredCommands.map((cmd, idx) => {
                const Icon = cmd.icon;
                const active = idx === activeIndex;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      cmd.action();
                      onClose();
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      active ? "bg-accent-soft" : "hover:bg-hover"
                    }`}
                  >
                    <div className="p-1.5 rounded-md bg-inset">
                      <Icon className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <span className="text-xs text-primary font-medium">{cmd.label}</span>
                    {active && <CornerDownLeft className="w-3 h-3 text-muted ml-auto" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Search results grouped by type */}
          {showResults && results.length > 0 && (
            <div>
              <div className="px-2 py-1 font-label text-faint uppercase">Results</div>
              {results.map((item, idx) => {
                const commandCount = filteredCommands.length;
                const active = idx + commandCount === activeIndex;
                const icon =
                  item.type === "product" ? (
                    <Box className="w-3.5 h-3.5 text-accent" />
                  ) : item.type === "server" ? (
                    <Server className="w-3.5 h-3.5 text-success" />
                  ) : item.type === "article" ? (
                    <BookOpen className="w-3.5 h-3.5 text-warning" />
                  ) : item.type === "organization" ? (
                    <Building2 className="w-3.5 h-3.5 text-purple" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-purple" />
                  );

                return (
                  <button
                    key={item.id}
                    onClick={() => handleResultNav(item.url)}
                    onMouseEnter={() => setActiveIndex(idx + commandCount)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-colors text-left ${
                      active ? "bg-accent-soft" : "hover:bg-hover"
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="p-1.5 rounded-md bg-inset shrink-0">{icon}</div>
                      <div className="overflow-hidden">
                        <div className="text-xs font-medium text-primary truncate">{item.title}</div>
                        <div className="text-[11px] text-muted truncate">{item.description}</div>
                      </div>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-inset text-secondary font-numeric ml-2 shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {showResults && !loading && results.length === 0 && filteredCommands.length === 0 && (
            <div className="text-center py-8 font-caption text-muted">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
