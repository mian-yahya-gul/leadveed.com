import Link from "next/link";

export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="lv-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a74ff" />
          <stop offset="1" stopColor="#4a30d0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#lv-g)" />
      <path d="M8 9.5 L14.2 22.5 L16.9 16.9" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M17.5 15.6 L20.6 9.5" stroke="#cdfb4f" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="23.6" cy="21.6" r="2.6" fill="#cdfb4f" />
    </svg>
  );
}

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-2" aria-label="LeadVeed home">
      <LogoMark />
      <span className={`font-display text-[19px] font-extrabold tracking-tight ${dark ? "text-white" : "text-ink-950"}`}>
        Lead<span className="text-brand-500">Veed</span>
      </span>
    </Link>
  );
}
