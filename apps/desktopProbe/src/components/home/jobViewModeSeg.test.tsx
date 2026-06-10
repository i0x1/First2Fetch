import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { JobViewModeSeg } from './jobViewModeSeg';

describe('JobViewModeSeg', () => {
  it('renders table/split/detail controls', () => {
    render(<JobViewModeSeg viewMode="split" onChange={vi.fn()} />);
    expect(screen.getByTestId('job-view-mode-seg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Table' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Split' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Detail' })).toBeInTheDocument();
  });

  it('calls onChange when a view mode is selected', () => {
    const onChange = vi.fn();
    render(<JobViewModeSeg viewMode="split" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Detail' }));
    expect(onChange).toHaveBeenCalledWith('detail-focus');
  });
});
