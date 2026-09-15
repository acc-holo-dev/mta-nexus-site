import * as React from "react";
import { cn } from "./utils";

export interface TabItem {
  id: string;
  label: string;
  badge?: number | string;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={cn("flex space-x-1 border-b border-neutral-800 pb-px overflow-x-auto", className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              isActive
                ? "border-blue-500 text-blue-400 font-semibold"
                : "border-transparent text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
            )}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-neutral-800 text-neutral-300">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
