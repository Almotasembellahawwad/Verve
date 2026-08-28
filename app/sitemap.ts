import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const pages = [
  { path: "", changeFrequency: "weekly" as const, priority: 1 },
  { path: "/showcase", changeFrequency: "monthly" as const, priority: 0.8 },
  { path: "/demos", changeFrequency: "monthly" as const, priority: 0.85 },
  { path: "/editor", changeFrequency: "monthly" as const, priority: 0.75 },
  { path: "/docs", changeFrequency: "weekly" as const, priority: 0.7 },
  { path: "/lab", changeFrequency: "monthly" as const, priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: new Date(),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
