"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import type { Notification } from "@nexus/domain";

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch {
        // silent — bell is non-critical UI
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
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
        className="relative p-2 rounded-md bg-elevated border border-base text-secondary hover:text-primary hover:bg-hover transition-colors cursor-pointer"
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-accent text-[10px] font-numeric font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 rounded-xl bg-elevated border border-strong shadow-nexus-lg py-2 z-50">
            <div className="flex items-center justify-between px-3 pb-2 border-b border-base">
              <span className="font-heading text-primary text-xs">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] text-accent hover:underline"
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-[color:var(--nexus-border)]">
              {notifications.length > 0 ? (
                notifications.slice(0, 6).map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 space-y-1 ${!n.isRead ? "bg-accent-soft" : "hover:bg-hover"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-primary text-xs truncate">{n.title}</span>
                      <span className="font-caption text-faint shrink-0">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="font-caption text-muted line-clamp-2">{n.message}</p>
                    {n.link && (
                      <Link
                        href={n.link}
                        onClick={() => setIsOpen(false)}
                        className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                      >
                        <span>View</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </Link>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-6 text-center font-caption text-muted">
                  No notifications yet
                </div>
              )}
            </div>

            <div className="pt-2 px-3 border-t border-base text-center">
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="font-caption text-muted hover:text-primary"
              >
                Open Notification Center →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
