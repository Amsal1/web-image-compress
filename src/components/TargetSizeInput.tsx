import { useState, useCallback, useEffect } from 'react';
import type { ChangeEvent, FocusEvent } from 'react';
import { validateTargetSize, saveTargetSize } from '../utils/targetSize';

interface TargetSizeInputProps {
  value: number;
  onChange: (kb: number) => void;
}

export function TargetSizeInput({ value, onChange }: TargetSizeInputProps) {
  const [inputValue, setInputValue] = useState(String(value));
  const [error, setError] = useState<string | null>(null);

  // Sync local state when the prop value changes externally
  useEffect(() => {
    setInputValue(String(value));
    setError(null);
  }, [value]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);

    const result = validateTargetSize(raw);
    setError(result.valid ? null : (result.error ?? 'Invalid value'));
  }, []);

  const handleBlur = useCallback(
    (_e: FocusEvent<HTMLInputElement>) => {
      const result = validateTargetSize(inputValue);
      if (result.valid && result.kb !== undefined) {
        setError(null);
        saveTargetSize(result.kb);
        onChange(result.kb);
      } else {
        // Revert to previous valid value
        setInputValue(String(value));
        setError(null);
      }
    },
    [inputValue, value, onChange],
  );

  const inputId = 'target-size-input';

  return (
    <div className="w-full max-w-xs">
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-gray-700">
        Target size (KB)
      </label>
      <input
        id={inputId}
        type="number"
        inputMode="numeric"
        min={10}
        max={10000}
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`
          w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors
          focus:outline-none focus:ring-2 focus:ring-offset-1
          ${error
            ? 'border-red-400 text-red-900 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500'
          }
        `}
      />
      {error && (
        <p id={`${inputId}-error`} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
