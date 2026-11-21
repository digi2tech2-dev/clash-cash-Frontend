const toAsciiDigits = (value) => String(value || '').replace(/[٠-٩۰-۹]/g, (digit) => {
  const code = digit.charCodeAt(0);
  return String(code >= 1776 ? code - 1776 : code - 1632);
});

export const getCallingCode = (country) => {
  return String(country?.idd?.root || '').trim();
};

export const normalizePhoneNumber = (phone, country) => {
  const dialDigits = toAsciiDigits(getCallingCode(country)).replace(/\D/g, '');
  const rawPhone = toAsciiDigits(phone).trim();
  let phoneDigits = toAsciiDigits(phone).replace(/\D/g, '');

  const hasPlusPrefix = rawPhone.startsWith('+');
  if (rawPhone.startsWith('00')) phoneDigits = phoneDigits.slice(2);
  if ((hasPlusPrefix || rawPhone.startsWith('00')) && dialDigits && phoneDigits.startsWith(dialDigits)) {
    phoneDigits = phoneDigits.slice(dialDigits.length);
  }
  phoneDigits = phoneDigits.replace(/^0+/, '');
  return dialDigits && phoneDigits ? `+${dialDigits}${phoneDigits}` : '';
};

export const validatePhoneNumber = (phone, country, language = 'ar') => {
  if (!String(phone || '').trim()) return language === 'en' ? 'Enter your phone number.' : 'أدخل رقم الهاتف.';
  const normalized = normalizePhoneNumber(phone, country);
  return /^\+[1-9]\d{7,14}$/.test(normalized)
    ? null
    : (language === 'en' ? 'Enter a valid phone number with its country code.' : 'أدخل رقم هاتف صحيحًا مع اختيار رمز الدولة.');
};
