// src/components/common/PhoneWithCountry.tsx
//
// Phone number with a country-code picker (195 countries, India by default).
// Indian numbers are saved exactly as before (just the number); any other
// country is saved as "+<code> <number>", e.g. "+86 131 2345 6789".
// See utils/countryCodes.ts.

import { useMemo, useState } from "react";
import { COUNTRY_CODES, DEFAULT_COUNTRY, joinPhone, splitPhone, type CountryCode } from "../../utils/countryCodes";

interface Props {
  value: string | null | undefined;
  onChange: (value: string) => void;
  /** Classes for the number box (match the form's other inputs). */
  className?: string;
  placeholder?: string;
}

// India first, then A–Z.
const OPTIONS: CountryCode[] = [
  DEFAULT_COUNTRY,
  ...COUNTRY_CODES.filter((c) => c !== DEFAULT_COUNTRY).sort((a, b) => a.name.localeCompare(b.name)),
];

export default function PhoneWithCountry({ value, onChange, className = "", placeholder }: Props) {
  const initial = useMemo(() => splitPhone(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  // Kept here too, so a picked country isn't lost while the number is empty.
  const [country, setCountry] = useState<CountryCode>(initial.country);
  const number = splitPhone(value).number;

  return (
    <div className="flex gap-2">
      <select
        value={country.name}
        onChange={(e) => {
          const next = OPTIONS.find((c) => c.name === e.target.value) ?? DEFAULT_COUNTRY;
          setCountry(next);
          onChange(joinPhone(next, number));
        }}
        aria-label="Country code"
        title={`${country.name} ${country.label}`}
        className={`${className} !w-[7.5rem] shrink-0`}
      >
        {OPTIONS.map((c) => (
          <option key={c.name} value={c.name}>
            {c.label} {c.name}
          </option>
        ))}
      </select>
      <input
        type="tel"
        value={number}
        onChange={(e) => onChange(joinPhone(country, e.target.value))}
        placeholder={placeholder ?? country.example}
        className={`${className} flex-1 min-w-0`}
      />
    </div>
  );
}