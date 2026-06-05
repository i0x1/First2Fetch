/**
 * Formatting helpers for dense job table rows.
 */
export function getCompanyInitials(companyName?: string | null): string {
  if (!companyName?.trim()) {
    return '?';
  }
  const parts = companyName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatShortRelativeTime(date: Date, now = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function formatShortPosted(postedRaw?: string | null): string {
  if (!postedRaw?.trim()) {
    return '—';
  }
  const value = postedRaw.trim();
  if (value.length <= 8) {
    return value;
  }
  return value.length > 16 ? `${value.slice(0, 14)}…` : value;
}

export function formatShortPostedWithFallback(
  postedRaw?: string | null,
  foundAt?: string | Date | null,
  now = new Date(),
): string {
  const posted = formatShortPosted(postedRaw);
  if (posted !== '—') {
    return posted;
  }

  if (!foundAt) {
    return '—';
  }

  const foundDate = foundAt instanceof Date ? foundAt : new Date(foundAt);
  if (Number.isNaN(foundDate.getTime())) {
    return '—';
  }

  return `${formatShortRelativeTime(foundDate, now)}+`;
}
