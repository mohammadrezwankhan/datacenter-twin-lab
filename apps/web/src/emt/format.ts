const englishFormatters = new Map<string, Intl.NumberFormat>();

function formatterFor(minimumFractionDigits: number, maximumFractionDigits: number) {
  const key = `${minimumFractionDigits}:${maximumFractionDigits}`;
  let formatter = englishFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en', {
      maximumFractionDigits,
      minimumFractionDigits,
    });
    englishFormatters.set(key, formatter);
  }
  return formatter;
}

export function emtNumber(value: number, digits = 2) {
  return formatterFor(0, digits).format(value);
}

export function emtSigned(value: number, digits = 6) {
  return `${value > 0 ? '+' : ''}${formatterFor(digits, digits).format(value)}`;
}

export function emtNumberText(value: number, digits = 0) {
  return formatterFor(digits, digits).format(value);
}
