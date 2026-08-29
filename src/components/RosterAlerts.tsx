import type { RosterAlert } from "../lib/rosterAlerts";

export default function RosterAlerts(props: { alerts: RosterAlert[] }) {
  if (props.alerts.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {props.alerts.map((a, i) => (
        <div
          key={i}
          className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
            a.level === "urgent"
              ? "border-red-800 bg-red-950/60 text-red-200"
              : "border-amber-800 bg-amber-950/50 text-amber-200"
          }`}
        >
          {a.level === "urgent" ? "🚨 " : "⚠ "}
          {a.text}
        </div>
      ))}
    </div>
  );
}
