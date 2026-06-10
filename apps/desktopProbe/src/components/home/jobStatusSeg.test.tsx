import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { JobStatusSeg } from './jobStatusSeg';

describe('JobStatusSeg', () => {
  it('renders compact segmented tabs with counts', () => {
    render(
      <JobStatusSeg
        status="new"
        counts={{ new: 18, applied: 3, archived: 12, filtered: 5 }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('job-status-seg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New 18' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skipped 5' })).toBeInTheDocument();
  });

  it('calls onChange when a segment is clicked', () => {
    const onChange = vi.fn();
    render(
      <JobStatusSeg
        status="new"
        counts={{ new: 18, applied: 3, archived: 12, filtered: 5 }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Applied 3' }));
    expect(onChange).toHaveBeenCalledWith('applied');
  });
});
