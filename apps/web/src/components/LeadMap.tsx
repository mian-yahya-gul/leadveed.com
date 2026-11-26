"use client";
import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

export interface MapPoint { id: string; name: string; lat: number; lon: number; score?: number; href?: string }

/** Free vector map (OpenFreeMap tiles, no API key). */
export function LeadMap({ points, className = "h-[520px]", zoom }: { points: MapPoint[]; className?: string; zoom?: number }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current || points.length === 0) return;
    let map: import("maplibre-gl").Map | undefined;
    let cancelled = false;
    import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !el.current) return;
      const m = new maplibregl.Map({
        container: el.current,
        style: "https://tiles.openfreemap.org/styles/positron",
        center: [points[0].lon, points[0].lat],
        zoom: zoom ?? 13,
        attributionControl: { compact: true },
      });
      map = m;
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      for (const p of points) {
        const dot = document.createElement("a");
        dot.href = p.href ?? "#";
        dot.title = p.name;
        dot.className = "block h-3.5 w-3.5 rounded-full border-2 border-white shadow-md ring-2 ring-brand-500/30";
        dot.style.background = (p.score ?? 0) >= 75 ? "#5a3ff2" : (p.score ?? 0) >= 55 ? "#8a74ff" : "#b7bad3";
        new maplibregl.Marker({ element: dot })
          .setLngLat([p.lon, p.lat])
          .setPopup(new maplibregl.Popup({ offset: 10, closeButton: false }).setText(p.name))
          .addTo(m);
      }
      if (points.length > 1 && zoom === undefined) {
        const b = new maplibregl.LngLatBounds();
        points.forEach((p) => b.extend([p.lon, p.lat]));
        m.fitBounds(b, { padding: 50, maxZoom: 15, duration: 0 });
      }
    });
    return () => { cancelled = true; map?.remove(); };
  }, [points, zoom]);
  return <div ref={el} className={`overflow-hidden rounded-2xl border border-ink-100 bg-ink-50 ${className}`} />;
}
