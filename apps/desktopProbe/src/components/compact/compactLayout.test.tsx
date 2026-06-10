import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CompactKvRow, CompactPanel } from './compactLayout';

describe('CompactPanel', () => {
  it('renders title and children', () => {
    render(
      <CompactPanel title="Subscription">
        <div>Body</div>
      </CompactPanel>,
    );
    expect(screen.getByText('Subscription')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });
});

describe('CompactKvRow', () => {
  it('renders label and value', () => {
    render(
      <table>
        <tbody>
          <CompactKvRow label="Plan" hint="Renews soon">
            PRO
          </CompactKvRow>
        </tbody>
      </table>,
    );
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Renews soon')).toBeInTheDocument();
    expect(screen.getByText('PRO')).toBeInTheDocument();
  });
});
