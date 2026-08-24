import { TASK_CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";

export function CategoryPills({
  value,
  onChange,
}: {
  value?: string;
  onChange: (category: string | undefined) => void;
}) {
  const options = ["All", ...TASK_CATEGORIES];
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {options.map((option) => {
        const isActive = option === "All" ? !value : value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option === "All" ? undefined : option)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-foreground hover:bg-accent",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
