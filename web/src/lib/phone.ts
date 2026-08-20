/** Normalize Kenyan mobiles to 2547XXXXXXXX / 2541XXXXXXXX. */
export function normalizeKenyaPhone(input: string): string | null {
  const digits = String(input || '').replace(/\D/g, '');
  let national = digits;
  if (digits.startsWith('254') && digits.length === 12) national = digits.slice(3);
  else if (digits.startsWith('0') && digits.length === 10) national = digits.slice(1);
  else if (digits.length === 9) national = digits;
  else return null;
  if (!/^[17]\d{8}$/.test(national)) return null;
  return `254${national}`;
}

export function formatKenyaPhone(msisdn: string): string {
  const digits = msisdn.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return `0${digits.slice(3)}`;
  return msisdn;
}
