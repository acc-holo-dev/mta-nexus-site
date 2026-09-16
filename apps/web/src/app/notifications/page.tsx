"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, CheckCheck, ExternalLink, ShieldAlert, ArrowLeft } from "lucide-react";
import type { Notification } from "@nexus/domain";

export default function NotificationCenterPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markAllRead = async () => {
    await fetch("/api/notifications/mark-read", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const filtered =
    filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#232838] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-2">
            <Link href="/workspace" className="hover:text-white flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              <span>Workspace</span>
            </Link>
            <span>/</span>
            <span className="text-neutral-200">Notifications</span>
          </div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-blue-500" />
            <span>Notification Center</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Track license activations, build updates, followed servers, and security alerts.
          </p>
        </div>

        {notifications.some((n) => !n.isRead) && (
          <button
            onClick={markAllRead}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-xs font-semibold text-blue-400 border border-[#232838] transition-colors cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark All as Read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === "all"
              ? "bg-blue-600 text-white"
              : "bg-neutral-900 text-neutral-400 hover:text-white border border-[#232838]"
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === "unread"
              ? "bg-blue-600 text-white"
              : "bg-neutral-900 text-neutral-400 hover:text-white border border-[#232838]"
          }`}
        >
          Unread ({notifications.filter((n) => !n.isRead).length})
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-xs text-neutral-400">Loading notifications...</div>
        ) : filtered.length > 0 ? (
          filtered.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-xl border border-[#232838] transition-colors ${
                !n.isRead ? "bg-blue-950/20 border-blue-900/40" : "bg-[#11131a]"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{n.title}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-neutral-900 border border-[#232838] text-neutral-400">
                      {n.type}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-300 leading-relaxed">{n.message}</p>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-[11px] text-neutral-500 font-mono">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                  {n.link && (
                    <Link
                      href={n.link}
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-16 text-center rounded-xl border border-dashed border-[#232838] bg-[#11131a]/40">
            <p className="text-sm text-neutral-400">No notifications to display.</p>
          </div>
        )}
      </div>
    </div>
  );
}
