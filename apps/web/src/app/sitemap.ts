import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/format";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/pricing", "/data-licensing", "/privacy", "/terms", "/remove-my-data"].map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: "weekly" }));
}
