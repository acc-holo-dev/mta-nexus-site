"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import type { Notification } from "@nexus/domain";

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // 30s poll
    return () => clearInterval(interval);
  }, []);

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications/mark-read", { method: "POST" });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg bg-neutral-900 border border-[#232838] text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
        aria-label="View notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl bg-[#11131a] border border-[#232838] shadow-2xl py-2 text-xs z-50 animate-in fade-in duration-150">
          <div className="flex items-center justify-between px-3 pb-2 border-b border-[#232838]">
            <span className="font-bold text-white">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] text-blue-400 hover:underline"
              >
                <CheckCheck className="w-3 h-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-neutral-800/60">
            {notifications.length > 0 ? (
              notifications.slice(0, 6).map((n) => (
                <div
                  key={n.id}
                  className={`p-3 space-y-1 transition-colors ${
                    !n.isRead ? "bg-blue-950/20" : "hover:bg-neutral-900/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white truncate">{n.title}</span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 line-clamp-2">{n.message}</p>
                  {n.link && (
                    <Link
                      href={n.link}
                      onClick={() => setIsOpen(false)}
                      className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:underline pt-0.5"
                    >
                      <span>View details</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                  )}
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-neutral-500 text-xs">
                No new notifications
              </div>
            )}
          </div>

          <div className="pt-2 px-3 border-t border-[#232838] text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-[11px] text-neutral-400 hover:text-white"
            >
              Open Notification Center →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
