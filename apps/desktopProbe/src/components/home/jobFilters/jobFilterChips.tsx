import { Cross2Icon } from '@radix-ui/react-icons';

import { useLinks } from '@/hooks/links';
import { useSites } from '@/hooks/sites';
import { JOB_LABELS } from '@first2apply/core';

import { JobFiltersType } from './jobFiltersMenu';

/** Active filter chips row — matches mock chip-row under the toolbar. */
export function JobFilterChips({
  siteIds,
  linkIds,
  labels,
  hideReposted,
  onApplyFilters,
}: {
  siteIds: number[];
  linkIds: number[];
  labels: string[];
  hideReposted: boolean;
  onApplyFilters: (filters: JobFiltersType) => void;
}) {
  const { sites } = useSites();
  const { links } = useLinks();

  const chips: { key: string; label: string; clear: () => void }[] = [];

  siteIds.forEach((siteId) => {
    const site = sites.find((s) => s.id === siteId);
    if (site) {
      chips.push({
        key: `site-${siteId}`,
        label: site.name,
        clear: () =>
          onApplyFilters({
            sites: siteIds.filter((id) => id !== siteId),
            links: linkIds,
            labels,
            hideReposted,
          }),
      });
    }
  });

  linkIds.forEach((linkId) => {
    const link = links.find((l) => l.id === linkId);
    if (link) {
      chips.push({
        key: `link-${linkId}`,
        label: link.title,
        clear: () =>
          onApplyFilters({
            sites: siteIds,
            links: linkIds.filter((id) => id !== linkId),
            labels,
            hideReposted,
          }),
      });
    }
  });

  labels.forEach((label) => {
    if (Object.values(JOB_LABELS).includes(label as (typeof JOB_LABELS)[keyof typeof JOB_LABELS])) {
      chips.push({
        key: `label-${label}`,
        label,
        clear: () =>
          onApplyFilters({
            sites: siteIds,
            links: linkIds,
            labels: labels.filter((l) => l !== label),
            hideReposted,
          }),
      });
    }
  });

  if (hideReposted) {
    chips.push({
      key: 'hide-reposted',
      label: 'Hide reposts',
      clear: () => onApplyFilters({ sites: siteIds, links: linkIds, labels, hideReposted: false }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground"
        >
          {chip.label}
          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={chip.clear} aria-label={`Remove ${chip.label}`}>
            <Cross2Icon className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        className="text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        onClick={() => onApplyFilters({ sites: [], links: [], labels: [], hideReposted: false })}
      >
        Clear all
      </button>
    </div>
  );
}
