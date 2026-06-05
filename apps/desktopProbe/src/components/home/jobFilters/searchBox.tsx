import { Cross2Icon, MagnifyingGlassIcon } from '@radix-ui/react-icons';

import { Input } from '@first2apply/ui';

/**
 * Search box component.
 */
export function SearchBox({
  inputValue,
  setInputValue,
}: {
  inputValue: string;
  setInputValue: (value: string) => void;
}) {
  const handleClearInput = () => {
    setInputValue('');
  };

  return (
    <div className="relative h-[30px] flex-grow">
      <Input
        className="h-full w-full overflow-x-scroll rounded-md border-border bg-card pl-8 pr-8 text-xs focus-visible:outline-none focus-visible:ring-0"
        placeholder="Search title or company..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />

      <MagnifyingGlassIcon className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />

      {inputValue && (
        <Cross2Icon
          className="absolute right-2.5 top-2 h-3.5 w-3.5 cursor-pointer text-muted-foreground"
          onClick={handleClearInput}
        />
      )}
    </div>
  );
}
