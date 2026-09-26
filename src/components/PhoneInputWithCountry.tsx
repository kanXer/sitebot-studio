'use client';

import React, { useMemo } from 'react';

export interface CountryOption {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

export const COUNTRIES: CountryOption[] = [
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳' },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧' },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦' },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺' },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬' },
  { code: 'QA', name: 'Qatar', dialCode: '+974', flag: '🇶🇦' },
  { code: 'KW', name: 'Kuwait', dialCode: '+965', flag: '🇰🇼' },
  { code: 'OM', name: 'Oman', dialCode: '+968', flag: '🇴🇲' },
  { code: 'BH', name: 'Bahrain', dialCode: '+973', flag: '🇧🇭' },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪' },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷' },
  { code: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸' },
  { code: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹' },
  { code: 'NL', name: 'Netherlands', dialCode: '+31', flag: '🇳🇱' },
  { code: 'CH', name: 'Switzerland', dialCode: '+41', flag: '🇨🇭' },
  { code: 'IE', name: 'Ireland', dialCode: '+353', flag: '🇮🇪' },
  { code: 'PK', name: 'Pakistan', dialCode: '+92', flag: '🇵🇰' },
  { code: 'BD', name: 'Bangladesh', dialCode: '+880', flag: '🇧🇩' },
  { code: 'NP', name: 'Nepal', dialCode: '+977', flag: '🇳🇵' },
  { code: 'LK', name: 'Sri Lanka', dialCode: '+94', flag: '🇱🇰' },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾' },
  { code: 'ID', name: 'Indonesia', dialCode: '+62', flag: '🇮🇩' },
  { code: 'PH', name: 'Philippines', dialCode: '+63', flag: '🇵🇭' },
  { code: 'TH', name: 'Thailand', dialCode: '+66', flag: '🇹🇭' },
  { code: 'VN', name: 'Vietnam', dialCode: '+84', flag: '🇻🇳' },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦' },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬' },
  { code: 'EG', name: 'Egypt', dialCode: '+20', flag: '🇪🇬' },
  { code: 'KE', name: 'Kenya', dialCode: '+254', flag: '🇰🇪' },
  { code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽' },
  { code: 'TR', name: 'Turkey', dialCode: '+90', flag: '🇹🇷' },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', flag: '🇳🇿' },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', dialCode: '+82', flag: '🇰🇷' },
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳' },
  { code: 'RU', name: 'Russia', dialCode: '+7', flag: '🇷🇺' },
];

// Sort sorted by dialCode length descending for accurate matching
const SORTED_DIAL_CODES = [...COUNTRIES].sort(
  (a, b) => b.dialCode.length - a.dialCode.length
);

export function parsePhoneNumber(raw: string, defaultDialCode = '+91'): { dialCode: string; nationalNumber: string } {
  if (!raw || !raw.trim()) {
    return { dialCode: defaultDialCode, nationalNumber: '' };
  }

  const clean = raw.trim();

  // If starts with +, try matching against known dial codes
  if (clean.startsWith('+')) {
    for (const c of SORTED_DIAL_CODES) {
      if (clean.startsWith(c.dialCode)) {
        return {
          dialCode: c.dialCode,
          nationalNumber: clean.slice(c.dialCode.length).replace(/\D/g, ''),
        };
      }
    }
    // Fallback: match + and 1-4 digits
    const m = clean.match(/^(\+\d{1,4})(.*)$/);
    if (m) {
      return {
        dialCode: m[1],
        nationalNumber: m[2].replace(/\D/g, ''),
      };
    }
  }

  // If no leading +, test if it starts with digits matching a known dial code without plus
  for (const c of SORTED_DIAL_CODES) {
    const rawCode = c.dialCode.replace('+', '');
    if (clean.startsWith(rawCode) && clean.length > rawCode.length + 5) {
      return {
        dialCode: c.dialCode,
        nationalNumber: clean.slice(rawCode.length).replace(/\D/g, ''),
      };
    }
  }

  // Otherwise treat entire cleaned string as national number with default dial code
  return {
    dialCode: defaultDialCode,
    nationalNumber: clean.replace(/\D/g, ''),
  };
}

interface PhoneInputWithCountryProps {
  value: string;
  onChange: (fullNumber: string) => void;
  placeholder?: string;
  disabled?: boolean;
  theme?: 'light' | 'dark';
  className?: string;
}

export function PhoneInputWithCountry({
  value,
  onChange,
  placeholder = '9876543210',
  disabled = false,
  theme = 'light',
  className = '',
}: PhoneInputWithCountryProps) {
  const { dialCode, nationalNumber } = useMemo(() => {
    return parsePhoneNumber(value);
  }, [value]);

  const handleDialCodeChange = (newDialCode: string) => {
    const full = nationalNumber ? `${newDialCode}${nationalNumber}` : '';
    onChange(full);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;

    // Handle pasting a full international number with +
    if (inputVal.includes('+')) {
      const parsed = parsePhoneNumber(inputVal, dialCode);
      const full = parsed.nationalNumber ? `${parsed.dialCode}${parsed.nationalNumber}` : '';
      onChange(full);
      return;
    }

    const cleanDigits = inputVal.replace(/\D/g, '');
    const full = cleanDigits ? `${dialCode}${cleanDigits}` : '';
    onChange(full);
  };

  const isDark = theme === 'dark';

  return (
    <div className={`flex w-full min-w-0 max-w-full items-center rounded-xl border shadow-sm transition-all focus-within:ring-2 ${
      isDark
        ? 'bg-slate-900 border-slate-800 text-white focus-within:border-emerald-500 focus-within:ring-emerald-500/20'
        : 'bg-white border-slate-300 text-slate-900 focus-within:border-emerald-600 focus-within:ring-emerald-600/20'
    } ${disabled ? 'opacity-60 pointer-events-none' : ''} ${className}`}>
      {/* Country Code Dropdown */}
      <div className="relative shrink-0 w-[100px] border-r border-slate-200 dark:border-slate-800">
        <select
          value={dialCode}
          disabled={disabled}
          onChange={(e) => handleDialCodeChange(e.target.value)}
          aria-label="Country dial code"
          className={`h-10 w-full pl-2 pr-6 py-2 text-xs font-bold rounded-l-xl bg-transparent appearance-none cursor-pointer focus:outline-none truncate ${
            isDark ? 'text-white' : 'text-slate-800'
          }`}
        >
          {COUNTRIES.map((c) => (
            <option
              key={`${c.code}-${c.dialCode}`}
              value={c.dialCode}
              className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}
            >
              {c.flag} {c.dialCode} ({c.name})
            </option>
          ))}
        </select>
        {/* Custom Caret */}
        <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-slate-400">
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {/* Local Phone Number Input */}
      <input
        type="tel"
        inputMode="numeric"
        disabled={disabled}
        value={nationalNumber}
        onChange={handleNumberChange}
        placeholder={placeholder}
        className={`w-full min-w-0 flex-1 px-3.5 py-2.5 text-xs font-medium bg-transparent focus:outline-none rounded-r-xl ${
          isDark
            ? 'text-white placeholder-slate-500'
            : 'text-slate-900 placeholder-slate-400'
        }`}
      />
    </div>
  );
}
