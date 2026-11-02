/** Parses what a person types ("1,250.50", "12.5", "12,5") into cents, or null if invalid. */
export function parseAmount(input: string, allowNegative = false): number | null {
  let s = input.trim().replace(/\s/g, '');
  const negative = s.startsWith('-');
  if (negative) {
    if (!allowNegative) return null;
    s = s.slice(1);
  }
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const cents = Number(whole || 0) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(/\.00$/, '');
}

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}
