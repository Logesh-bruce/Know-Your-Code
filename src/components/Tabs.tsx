import clsx from "clsx";

interface TabsProps {
  tabs: string[];
  active: string;
  onChange: (label: string) => void;
}

export default function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div
      className="flex items-center gap-6 border-b border-line"
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab === active;
        return (
          <button
            key={tab}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab)}
            className={clsx(
              "-mb-px appearance-none border-b-2 bg-transparent px-1 py-2 text-sm transition-colors duration-150 ease-in-out",
              isActive
                ? "border-accent text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}