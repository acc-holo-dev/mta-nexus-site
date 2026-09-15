"use client";

import React, { useState, useEffect } from "react";
import { Search, X, Box, Server, BookOpen, User, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { SearchResultItem } from "../lib/services/discovery-service";

export function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else setResults([]);
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
      } catch (e) {
        console.error("Search error:", e);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#11131a] border border-[#232838] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center px-4 py-3.5 border-b border-[#232838]">
          <Search className="w-5 h-5 text-neutral-400 mr-3" />
          <input
            autoFocus
            type="text"
            placeholder="Search MTA products, servers, articles, developers... (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-neutral-400 hover:text-white mr-2">
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 bg-neutral-800 text-neutral-400 rounded hover:text-white"
          >
            ESC
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {loading && <div className="text-center py-6 text-sm text-neutral-400">Searching MTA ecosystem...</div>}

          {!loading && query && results.length === 0 && (
            <div className="text-center py-8 text-sm text-neutral-500">
              No results matching &ldquo;{query}&rdquo;
            </div>
          )}

          {!loading && !query && (
            <div className="p-4 text-xs text-neutral-500 flex flex-wrap gap-2">
              <span>Quick tags:</span>
              <button
                onClick={() => setQuery("inventory")}
                className="px-2 py-0.5 bg-neutral-800 rounded hover:text-neutral-200"
              >
                #inventory
              </button>
              <button
                onClick={() => setQuery("drift")}
                className="px-2 py-0.5 bg-neutral-800 rounded hover:text-neutral-200"
              >
                #drift
              </button>
              <button
                onClick={() => setQuery("cef")}
                className="px-2 py-0.5 bg-neutral-800 rounded hover:text-neutral-200"
              >
                #cef
              </button>
              <button
                onClick={() => setQuery("roleplay")}
                className="px-2 py-0.5 bg-neutral-800 rounded hover:text-neutral-200"
              >
                #roleplay
              </button>
            </div>
          )}

          <div className="space-y-1">
            {results.map((item) => {
              const icon =
                item.type === "product" ? (
                  <Box className="w-4 h-4 text-blue-400" />
                ) : item.type === "server" ? (
                  <Server className="w-4 h-4 text-emerald-400" />
                ) : item.type === "article" ? (
                  <BookOpen className="w-4 h-4 text-amber-400" />
                ) : (
                  <User className="w-4 h-4 text-purple-400" />
                );

              return (
                <Link
                  key={item.id}
                  href={item.url}
                  onClick={onClose}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-800/60 transition-colors group"
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="p-2 rounded-md bg-neutral-800">{icon}</div>
                    <div className="overflow-hidden">
                      <div className="text-sm font-medium text-neutral-200 group-hover:text-white truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-neutral-400 truncate">{item.description}</div>
                    </div>
                  </div>
                  {item.badge && (
                    <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 ml-2 whitespace-nowrap">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
