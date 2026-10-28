import { cn } from "./utils";

export interface TabItem {
  id: string;
  label: string;
  badge?: number | string;
}

export function nextTabIndex(length: number, currentIndex: number, key: string): number | null {
  if (length <= 0) return null;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  if (key === "ArrowRight") return (currentIndex + 1 + length) % length;
  if (key === "ArrowLeft") return (currentIndex - 1 + length) % length;
  return null;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn("flex space-x-1 overflow-x-auto border-b border-base pb-px", className)}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTab;
        const isFallbackTabStop = activeIndex < 0 && index === 0;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive || isFallbackTabStop ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              const nextIndex = nextTabIndex(tabs.length, index, event.key);
              if (nextIndex === null) return;
              event.preventDefault();
              const nextTab = tabs[nextIndex];
              if (!nextTab) return;
              onChange(nextTab.id);
              const controls =
                event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]');
              controls?.[nextIndex]?.focus();
            }}
            className={cn(
              "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--nexus-accent)]",
              isActive
                ? "border-[color:var(--nexus-accent)] font-semibold text-accent"
                : "border-transparent text-muted hover:border-strong hover:text-primary",
            )}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className="rounded-full bg-inset px-1.5 py-0.5 text-xs text-secondary">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
