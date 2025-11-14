import { PlusIcon, TrashIcon } from '@radix-ui/react-icons';
import { useState, useEffect } from 'react';

import { Button } from '@first2apply/ui';
import { Input } from '@first2apply/ui';
import { Label } from '@first2apply/ui';
import { Separator } from '@first2apply/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@first2apply/ui';

import { 
  QueryParam, 
  parseUrlQueryParams, 
  buildUrlFromParams, 
  getParamLabel,
  suggestParamKeys,
  isValidUrl 
} from '@/lib/urlUtils';

interface UrlQueryEditorProps {
  url: string;
  onUrlChange: (newUrl: string) => void;
  disabled?: boolean;
}

export function UrlQueryEditor({ url, onUrlChange, disabled = false }: UrlQueryEditorProps) {
  const [baseUrl, setBaseUrl] = useState('');
  const [queryParams, setQueryParams] = useState<QueryParam[]>([]);
  const [hash, setHash] = useState('');
  const [showSuggestions, setShowSuggestions] = useState<number | null>(null);
  const [suggestionInput, setSuggestionInput] = useState('');

  // Parse URL when it changes
  useEffect(() => {
    const parsed = parseUrlQueryParams(url);
    setBaseUrl(parsed.baseUrl);
    setQueryParams(parsed.queryParams);
    setHash(parsed.hash);
  }, [url]);

  // Update URL when parameters change
  useEffect(() => {
    const newUrl = buildUrlFromParams(baseUrl, queryParams, hash);
    if (newUrl !== url && isValidUrl(newUrl)) {
      onUrlChange(newUrl);
    }
  }, [baseUrl, queryParams, hash]);

  const addParameter = () => {
    const newParam: QueryParam = {
      key: '',
      value: '',
      originalKey: '',
    };
    setQueryParams([...queryParams, newParam]);
  };

  const removeParameter = (index: number) => {
    const newParams = queryParams.filter((_, i) => i !== index);
    setQueryParams(newParams);
  };

  const updateParameter = (index: number, field: 'key' | 'value', value: string) => {
    const newParams = [...queryParams];
    newParams[index] = {
      ...newParams[index],
      [field]: value,
    };
    setQueryParams(newParams);
  };

  const updateBaseUrl = (newBaseUrl: string) => {
    setBaseUrl(newBaseUrl);
  };

  const getSuggestions = (input: string) => {
    return suggestParamKeys(input);
  };

  const applySuggestion = (index: number, suggestion: string) => {
    updateParameter(index, 'key', suggestion);
    setShowSuggestions(null);
    setSuggestionInput('');
  };

  return (
    <div className="space-y-4">
      {/* Base URL Editor */}
      <div className="space-y-2">
        <Label htmlFor="base-url" className="text-sm font-medium">
          Base URL
        </Label>
        <Input
          id="base-url"
          value={baseUrl}
          onChange={(e) => updateBaseUrl(e.target.value)}
          placeholder="https://example.com/jobs"
          disabled={disabled}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          The main URL without query parameters
        </p>
      </div>

      <Separator />

      {/* Query Parameters Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Query Parameters</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addParameter}
            disabled={disabled}
            className="h-8 px-3"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Parameter
          </Button>
        </div>

        {queryParams.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No query parameters</p>
            <p className="text-xs mt-1">Click "Add Parameter" to add search filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queryParams.map((param, index) => (
              <div key={index} className="space-y-2 p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-muted-foreground">
                    Parameter {index + 1}
                    {param.key && (
                      <span className="ml-2 text-foreground">
                        ({getParamLabel(param.key)})
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeParameter(index)}
                    disabled={disabled}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Parameter Key */}
                  <div className="space-y-1 relative">
                    <Label className="text-xs">Parameter Name</Label>
                    <Input
                      value={param.key}
                      onChange={(e) => {
                        updateParameter(index, 'key', e.target.value);
                        setSuggestionInput(e.target.value);
                        setShowSuggestions(e.target.value ? index : null);
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowSuggestions(null), 200);
                      }}
                      placeholder="e.g., q, location, experience"
                      disabled={disabled}
                      className="font-mono text-sm"
                    />
                    
                    {/* Suggestions Dropdown */}
                    {showSuggestions === index && suggestionInput && (
                      <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
                        {getSuggestions(suggestionInput).map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                            onClick={() => applySuggestion(index, suggestion)}
                          >
                            <div className="font-mono text-xs text-muted-foreground">
                              {suggestion}
                            </div>
                            <div className="text-sm">
                              {getParamLabel(suggestion)}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Parameter Value */}
                  <div className="space-y-1">
                    <Label className="text-xs">Value</Label>
                    <Input
                      value={param.value}
                      onChange={(e) => updateParameter(index, 'value', e.target.value)}
                      placeholder="Parameter value"
                      disabled={disabled}
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* Show URL preview for this parameter */}
                {param.key && param.value && (
                  <div className="text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded">
                    URL part: ?{param.key}={encodeURIComponent(param.value)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hash Fragment */}
      {hash && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="hash" className="text-sm font-medium">
              URL Fragment (Hash)
            </Label>
            <Input
              id="hash"
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              placeholder="#section"
              disabled={disabled}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              The part after # in the URL
            </p>
          </div>
        </>
      )}

      {/* Final URL Preview */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Final URL Preview</Label>
        <div className="p-3 bg-muted/50 rounded-lg border">
          <p className="text-sm font-mono break-all">
            {buildUrlFromParams(baseUrl, queryParams, hash)}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className={`w-2 h-2 rounded-full ${isValidUrl(buildUrlFromParams(baseUrl, queryParams, hash)) ? 'bg-green-500' : 'bg-red-500'}`} />
          {isValidUrl(buildUrlFromParams(baseUrl, queryParams, hash)) ? 'Valid URL' : 'Invalid URL'}
        </div>
      </div>

      {/* Help Text */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p><strong>Tip:</strong> Common job search parameters include:</p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          <li><code>q</code> or <code>query</code> - Search terms</li>
          <li><code>location</code> or <code>l</code> - Job location</li>
          <li><code>experience</code> or <code>level</code> - Experience level</li>
          <li><code>type</code> - Job type (full-time, part-time, etc.)</li>
          <li><code>remote</code> - Remote work options</li>
          <li><code>salary</code> - Salary range</li>
        </ul>
      </div>
    </div>
  );
}
