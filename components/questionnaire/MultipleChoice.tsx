'use client';

import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
}

interface MultipleChoiceProps {
  options: Option[];
  value?: string;
  onChange: (value: string) => void;
  name: string;
}

export default function MultipleChoice({
  options,
  value,
  onChange,
  name
}: MultipleChoiceProps) {
  return (
    <div className="space-y-3">
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all",
            value === option.value
              ? "border-tis-coral bg-tis-coral/10 font-semibold"
              : "border-gray-200 hover:border-tis-coral hover:bg-tis-coral/5"
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
          />
          <span className="text-base">{option.label}</span>
        </label>
      ))}
    </div>
  );
}
