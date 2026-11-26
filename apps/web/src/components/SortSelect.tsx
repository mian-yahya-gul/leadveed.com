"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <select aria-label="Sort results" value={value} className="input w-auto py-2 pr-8 text-xs font-semibold"
      onChange={(e) => {
        const n = new URLSearchParams(sp.toString());
        n.set("sort", e.target.value);
        n.delete("page");
        router.push(`${pathname}?${n}`, { scroll: false });
      }}>
      <option value="relevance">Best match</option>
      <option value="quality">Highest quality</option>
      <option value="newest">Newest first</option>
    </select>
  );
}
