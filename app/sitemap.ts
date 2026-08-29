import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const pages = [
  { path: "", changeFrequency: "weekly" as const, priority: 1 },
  { path: "/create", changeFrequency: "weekly" as const, priority: 0.9 },
  { path: "/examples", changeFrequency: "monthly" as const, priority: 0.85 },
  { path: "/examples/architecture", changeFrequency: "monthly" as const, priority: 0.75 },
  { path: "/examples/cairo", changeFrequency: "monthly" as const, priority: 0.75 },
  { path: "/examples/carbon", changeFrequency: "monthly" as const, priority: 0.75 },
  { path: "/editor", changeFrequency: "monthly" as const, priority: 0.75 },
  { path: "/docs", changeFrequency: "weekly" as const, priority: 0.7 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: new Date(),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
