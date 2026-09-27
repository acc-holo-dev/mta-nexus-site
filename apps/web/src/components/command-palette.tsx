"use client";

import { useEffect, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  Box,
  Building2,
  Compass,
  CornerDownLeft,
  LayoutDashboard,
  MessageSquare,
  Search,
  Server,
  Settings,
  Star,
  User,
} from "lucide-react";
import type { SearchResultItem } from "../lib/services/discovery-service";
import { searchResultLabel } from "../lib/search-result-label";
import { useNexusLocale } from "./locale-context";

interface Command {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  action: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { dictionary, locale } = useNexusLocale();
  const copy = dictionary.commandPalette;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searchRevision, setSearchRevision] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const commands: Command[] = [
    {
      id: "go-market",
      label: copy.goMarket,
      icon: Star,
      action: () => router.push("/market"),
    },
    {
      id: "go-servers",
      label: copy.goServers,
      icon: Server,
      action: () => router.push("/servers"),
    },
    {
      id: "go-explore",
      label: copy.goExplore,
      icon: Compass,
      action: () => router.push("/explore"),
    },
    {
      id: "go-community",
      label: copy.goCommunity,
      icon: MessageSquare,
      action: () => router.push("/community"),
    },
    {
      id: "open-workspace",
      label: copy.openWorkspace,
      icon: LayoutDashboard,
      action: () => router.push("/workspace"),
    },
    {
      id: "open-saved",
      label: copy.openSaved,
      icon: BookOpen,
      action: () => router.push("/workspace/saved"),
    },
    {
      id: "open-notifications",
      label: copy.openNotifications,
      icon: Bell,
      action: () => router.push("/notifications"),
    },
    {
      id: "open-settings",
      label: copy.openSettings,
      icon: Settings,
      action: () => router.push("/settings"),
    },
  ];

  const normalizedQuery = query.trim().toLowerCase();
  const filteredCommands = normalizedQuery
    ? commands.filter((command) =>
        command.label.toLowerCase().includes(normalizedQuery),
      )
    : commands;

  useEffect(() => {
    if (!isOpen) return;

    setQuery("");
    setResults([]);
    setLoading(false);
    setSearchError(false);
    setActiveIndex(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !query.trim()) {
      setResults([]);
      setLoading(false);
      setSearchError(false);
      return;
    }

    setResults([]);
    setSearchError(false);
    const controller = new AbortController();
    let active = true;
    let requestTimeout: number | undefined;

    const timer = window.setTimeout(async () => {
      setLoading(true);
      requestTimeout = window.setTimeout(
        () => controller.abort(),
        10_000,
      );

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}`,
          {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          },
        );
        const data = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(data?.results)) {
          throw new Error("Search unavailable");
        }
        if (active) setResults(data.results);
      } catch {
        if (active) {
          setResults([]);
          setSearchError(true);
        }
      } finally {
        if (requestTimeout !== undefined) {
          window.clearTimeout(requestTimeout);
        }
        if (active) setLoading(false);
      }
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timer);
      if (requestTimeout !== undefined) {
        window.clearTimeout(requestTimeout);
      }
      controller.abort();
    };
  }, [isOpen, query, searchRevision]);

  if (!isOpen) return null;

  const totalItems = filteredCommands.length + results.length;
  const showResults = query.trim().length > 0;

  function navigate(url: string) {
    onClose();
    router.push(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={copy.dialogLabel}
    >
      <div
        className="flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-strong bg-elevated shadow-nexus-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center border-b border-base px-4 py-3">
          <Search className="mr-3 h-4 w-4 text-muted" aria-hidden="true" />
          <input
            autoFocus
            type="search"
            placeholder={copy.searchPlaceholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && totalItems > 0) {
                event.preventDefault();
                setActiveIndex((index) =>
                  Math.min(index + 1, totalItems - 1),
                );
              }
              if (event.key === "ArrowUp" && totalItems > 0) {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              }
              if (event.key === "Enter" && totalItems > 0) {
                event.preventDefault();
                if (activeIndex < filteredCommands.length) {
                  filteredCommands[activeIndex]?.action();
                  onClose();
                } else {
                  const result =
                    results[activeIndex - filteredCommands.length];
                  if (result) navigate(result.url);
                }
              }
            }}
            className="w-full bg-transparent text-sm text-primary placeholder:text-muted focus:outline-none"
            aria-label={copy.searchLabel}
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-base bg-inset px-1.5 py-0.5 font-numeric text-[10px] text-muted"
            aria-label={copy.close}
          >
            ESC
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {loading && showResults && (
            <div role="status" className="py-4 text-center font-caption text-muted">
              {copy.searching}
            </div>
          )}

          {filteredCommands.length > 0 && (
            <div className="mb-1">
              <div className="px-2 py-1 font-label uppercase text-faint">
                {copy.commands}
              </div>
              {filteredCommands.map((command, index) => {
                const Icon = command.icon;
                const active = index === activeIndex;

                return (
                  <button
                    key={command.id}
                    type="button"
                    onClick={() => {
                      command.action();
                      onClose();
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                      active ? "bg-accent-soft" : "hover:bg-hover"
                    }`}
                  >
                    <span className="rounded-md bg-inset p-1.5">
                      <Icon className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                    </span>
                    <span className="text-xs font-medium text-primary">
                      {command.label}
                    </span>
                    {active && (
                      <CornerDownLeft
                        className="ml-auto h-3 w-3 text-muted"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {showResults && results.length > 0 && (
            <div>
              <div className="px-2 py-1 font-label uppercase text-faint">
                {copy.results}
              </div>
              {results.map((item, index) => {
                const commandCount = filteredCommands.length;
                const active = index + commandCount === activeIndex;
                const icon =
                  item.type === "product" ? (
                    <Box className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                  ) : item.type === "server" ? (
                    <Server className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  ) : item.type === "article" ? (
                    <BookOpen className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                  ) : item.type === "organization" ? (
                    <Building2 className="h-3.5 w-3.5 text-purple" aria-hidden="true" />
                  ) : (
                    <User className="h-3.5 w-3.5 text-purple" aria-hidden="true" />
                  );

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.url)}
                    onMouseEnter={() =>
                      setActiveIndex(index + commandCount)
                    }
                    className={`flex w-full items-center justify-between rounded-lg p-2.5 text-left transition-colors ${
                      active ? "bg-accent-soft" : "hover:bg-hover"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="shrink-0 rounded-md bg-inset p-1.5">
                        {icon}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-primary">
                          {item.title}
                        </span>
                        <span className="block truncate text-[11px] text-muted">
                          {item.description}
                        </span>
                      </span>
                    </span>
                    <span className="ml-2 shrink-0 rounded bg-inset px-1.5 py-0.5 font-numeric text-[10px] text-secondary">
                      {searchResultLabel(item, locale)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {showResults && searchError && (
            <div role="alert" className="flex items-center justify-between gap-3 px-3 py-4 text-xs text-danger">
              <span>{copy.searchUnavailable}</span>
              <button
                type="button"
                onClick={() => setSearchRevision((value) => value + 1)}
                className="shrink-0 rounded-md border border-base px-3 py-1.5 font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nexus-accent)]"
              >
                {copy.retry}
              </button>
            </div>
          )}

          {showResults &&
            !loading &&
            !searchError &&
            results.length === 0 &&
            filteredCommands.length === 0 && (
              <div className="py-8 text-center font-caption text-muted">
                {copy.noResults} &ldquo;{query}&rdquo;
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
