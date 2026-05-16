export function shortHash(value: string, prefix = "0x"): string {
  if (!value) return "Not recorded";
  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  return `${prefix}${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

export function maskEmploymentId(value: string): string {
  const [prefix] = value.split("-");
  return `${prefix}-***`;
}

export function formatRole(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
