export const fmtDistance = (m?: number | null) => {
  if (m == null) return "—";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
};
export const fmtDuration = (s?: number | null) => {
  if (s == null) return "—";
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
};
export const fmtTime = (d?: string | Date | null) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
export const fmtDateTime = (d?: string | Date | null) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};
export const relativeTime = (d?: string | Date | null) => {
  if (!d) return "never";
  const dt = typeof d === "string" ? new Date(d) : d;
  const diff = (Date.now() - dt.getTime()) / 1000;
  if (diff < 5) return "just now";
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
};
