import React, { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { COUNTRY_CATALOG } from '../../data/countryCatalog';
import { getCallingCode } from '../../utils/phone';

const flagFromCode = (cca2 = '') => Array.from(String(cca2).toUpperCase())
  .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
  .join('');

const getLocalizedName = (country, language) => {
  try {
    const names = new Intl.DisplayNames([language === 'en' ? 'en' : 'ar'], { type: 'region' });
    return names.of(country.cca2) || country.name?.common || country.cca2;
  } catch {
    return country.name?.common || country.cca2;
  }
};

const CountryPhoneInput = ({
  countryCode = 'EG',
  onCountryCodeChange,
  value = '',
  onChange,
  error = '',
  language = 'ar',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const isEnglish = language === 'en';

  const countries = useMemo(() => COUNTRY_CATALOG.map((country) => ({
    ...country,
    callingCode: getCallingCode(country),
    localizedName: getLocalizedName(country, language),
    flag: flagFromCode(country.cca2),
  })).filter((country) => /^\+\d+$/.test(country.callingCode)), [language]);

  const selectedCountry = countries.find((country) => country.cca2 === countryCode) || countries[0];
  const filteredCountries = countries.filter((country) => (
    `${country.localizedName} ${country.name?.common || ''} ${country.cca2} ${country.callingCode}`
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  ));

  const chooseCountry = (country) => {
    onCountryCodeChange(country.cca2);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="relative space-y-1.5">
      <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
        {isEnglish ? 'Phone number' : 'رقم الهاتف'} <span className="text-rose-500">*</span>
      </label>
      <div className={`flex min-h-11 items-stretch overflow-hidden rounded-[var(--radius-md)] border bg-[color:rgb(var(--color-card-rgb)/0.55)] transition ${error ? 'border-rose-500' : 'border-[color:rgb(180_132_43/.38)] focus-within:border-[var(--color-primary)]'}`} dir="ltr">
        <button
          type="button"
          aria-label={isEnglish ? 'Choose country calling code' : 'اختر رمز الدولة'}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          className="flex shrink-0 items-center gap-1.5 border-r border-[color:rgb(var(--color-border-rgb)/.7)] px-2.5 text-sm font-bold text-[var(--color-text)] hover:bg-[color:rgb(var(--color-primary-rgb)/.06)]"
        >
          <span className="text-lg leading-none">{selectedCountry?.flag || '🌐'}</span>
          <span>{selectedCountry?.callingCode}</span>
          <ChevronDown className="h-3.5 w-3.5 text-[var(--color-muted)]" />
        </button>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={isEnglish ? 'Phone number' : 'أدخل رقم الهاتف'}
          aria-invalid={Boolean(error)}
          className="min-w-0 flex-1 bg-transparent px-3 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-muted)]"
        />
      </div>
      {error ? <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-300">{error}</p> : null}

      {isOpen && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl">
          <div className="border-b border-[var(--color-border)] p-2">
            <div className="flex h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3">
              <Search className="h-4 w-4 shrink-0 text-[var(--color-muted)]" />
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={isEnglish ? 'Search country' : 'ابحث باسم الدولة'}
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-muted)]"
              />
            </div>
          </div>
          <div role="listbox" className="max-h-60 overflow-y-auto p-1">
            {filteredCountries.length ? filteredCountries.map((country) => (
              <button
                key={country.cca2}
                type="button"
                role="option"
                aria-selected={country.cca2 === countryCode}
                onClick={() => chooseCountry(country)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-sm text-[var(--color-text)] hover:bg-[color:rgb(var(--color-primary-rgb)/.09)]"
              >
                <span className="text-lg leading-none">{country.flag}</span>
                <span className="min-w-0 flex-1 truncate">{country.localizedName}</span>
                <span className="shrink-0 font-semibold text-[var(--color-text-secondary)]" dir="ltr">{country.callingCode}</span>
              </button>
            )) : (
              <p className="px-3 py-4 text-center text-sm text-[var(--color-muted)]">
                {isEnglish ? 'No country found' : 'لم يتم العثور على دولة'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CountryPhoneInput;
