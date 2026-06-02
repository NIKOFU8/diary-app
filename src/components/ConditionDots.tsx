// Minimal 5-step condition meter (no emoji). Used in list/detail views.
export default function ConditionDots({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`体調 ${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`h-1.5 w-1.5 rounded-full ${n <= value ? "bg-indigo-500" : "bg-slate-200"}`}
        />
      ))}
    </span>
  );
}
