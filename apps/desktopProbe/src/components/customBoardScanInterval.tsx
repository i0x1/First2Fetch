import {
  CUSTOM_BOARD_SCAN_INTERVALS,
  DEFAULT_CUSTOM_BOARD_SCAN_INTERVAL_MINUTES,
  MAX_CUSTOM_BOARD_SCAN_INTERVAL_MINUTES,
  MIN_CUSTOM_BOARD_SCAN_INTERVAL_MINUTES,
} from '@/lib/types';
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@first2apply/ui';
import { useEffect, useState } from 'react';

const CUSTOM_VALUE = 'custom';

export function formatScanInterval(minutes: number): string {
  if (minutes < 60 || minutes % 60 !== 0) return `Every ${minutes} min`;
  if (minutes === 60) return 'Every hour';
  if (minutes === 1440) return 'Every 24 hours';
  return `Every ${minutes / 60} hours`;
}

function isPreset(minutes: number) {
  return (CUSTOM_BOARD_SCAN_INTERVALS as readonly number[]).includes(minutes);
}

export function parseCustomInterval(raw: string): number | null {
  const value = Number(raw.trim());
  if (!Number.isInteger(value)) return null;
  if (value < MIN_CUSTOM_BOARD_SCAN_INTERVAL_MINUTES || value > MAX_CUSTOM_BOARD_SCAN_INTERVAL_MINUTES) return null;
  return value;
}

/**
 * How often custom job boards (Simplify, YC, JobSignal, ...) are parsed. Presets plus a
 * free-form number of minutes.
 */
export function CustomBoardScanInterval({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (minutes: number) => void;
}) {
  const current = value ?? DEFAULT_CUSTOM_BOARD_SCAN_INTERVAL_MINUTES;
  const [isCustom, setIsCustom] = useState(() => !isPreset(current));
  const [draft, setDraft] = useState(String(current));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDraft(String(current));
    if (!isPreset(current)) setIsCustom(true);
  }, [current]);

  const commitDraft = () => {
    const parsed = parseCustomInterval(draft);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (parsed !== current) onChange(parsed);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={isCustom ? CUSTOM_VALUE : String(current)}
        onValueChange={(selected) => {
          if (selected === CUSTOM_VALUE) {
            setIsCustom(true);
            return;
          }
          setIsCustom(false);
          setInvalid(false);
          onChange(Number(selected));
        }}
      >
        <SelectTrigger className="h-6 w-[132px] text-[10px]" aria-label="Custom board scan interval">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CUSTOM_BOARD_SCAN_INTERVALS.map((minutes) => (
            <SelectItem key={minutes} value={String(minutes)}>
              {formatScanInterval(minutes)}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM_VALUE}>Custom…</SelectItem>
        </SelectContent>
      </Select>
      {isCustom && (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            inputMode="numeric"
            min={MIN_CUSTOM_BOARD_SCAN_INTERVAL_MINUTES}
            max={MAX_CUSTOM_BOARD_SCAN_INTERVAL_MINUTES}
            step={1}
            aria-label="Custom board scan interval in minutes"
            aria-invalid={invalid}
            className={`h-6 w-[72px] px-1.5 text-[10px] ${invalid ? 'border-destructive' : ''}`}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setInvalid(false);
            }}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitDraft();
            }}
          />
          <span className={`text-[10px] ${invalid ? 'text-destructive' : 'text-muted-foreground'}`}>
            {invalid ? `${MIN_CUSTOM_BOARD_SCAN_INTERVAL_MINUTES}–${MAX_CUSTOM_BOARD_SCAN_INTERVAL_MINUTES} min` : 'min'}
          </span>
        </div>
      )}
    </div>
  );
}
