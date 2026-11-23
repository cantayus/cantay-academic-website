/// <reference types="vite/client" />

/** Prefix site-local URLs for either a custom domain or a GitHub project path. */
export function withBasePath(url: string): string {
  if (!url || !url.startsWith("/") || url.startsWith("//")) return url;
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base === "/" ? "" : `/${base.replace(/^\/+|\/+$/g, "")}`;
  if (!prefix) return url;
  const pathname = url.split(/[?#]/, 1)[0];
  if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return url;
  return `${prefix}${url}`;
}

/** Map URL strings in JSON content without mutating the canonical source data. */
export function deepMapLocalUrls<T>(value: T): T {
  if (typeof value === "string") return withBasePath(value) as T;
  if (Array.isArray(value)) return value.map(item => deepMapLocalUrls(item)) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, deepMapLocalUrls(item)]),
    ) as T;
  }
  return value;
}

/** Alias for callers mapping a complete bundled content snapshot. */
export const withBasePaths = deepMapLocalUrls;
