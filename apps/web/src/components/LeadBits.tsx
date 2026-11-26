import { Globe, Mail, Phone, Share2, Gauge, Layers } from "lucide-react";
import { gradeColor, speedColor } from "@/lib/format";
import type { Lead } from "@/lib/types";

export function QualityBadge({ score, grade, size = "sm" }: { score: number; grade: string; size?: "sm" | "lg" }) {
  return (
    <span title={`Quality score ${score}/100`}
      className={`inline-flex items-center gap-1 rounded-full font-bold ring-1 ring-inset ${gradeColor(grade)} ${size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-[11px]"}`}>
      {grade}<span className="font-medium opacity-70">{score}</span>
    </span>
  );
}

export function Signals({ lead }: { lead: Lead }) {
  const items = [
    { on: lead.signals.hasPhone, icon: Phone, label: "Phone" },
    { on: lead.signals.hasWebsite, icon: Globe, label: "Website" },
    { on: lead.signals.hasEmail, icon: Mail, label: "Email" },
    { on: lead.signals.hasSocials, icon: Share2, label: "Social profiles" },
  ];
  return (
    <div className="flex items-center gap-1">
      {items.map(({ on, icon: Icon, label }) => (
        <span key={label} title={`${label}${on ? "" : " not found"}`}
          className={`grid h-6 w-6 place-items-center rounded-md ${on ? "bg-brand-50 text-brand-700" : "bg-ink-50 text-ink-300"}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      ))}
      {lead.sourceCount > 1 && (
        <span title="Confirmed by more than one source" className="grid h-6 w-6 place-items-center rounded-md bg-signal-300/60 text-ink-800">
          <Layers className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}

export function SpeedPill({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-ink-300">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${speedColor(score)}`} title="Google PageSpeed (mobile)">
      <Gauge className="h-3.5 w-3.5" /> {score}
    </span>
  );
}

export function NoWebsiteTag() {
  return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">No website</span>;
}
