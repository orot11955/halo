const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
  ['second', 1],
];

export function timeAgo(input: string | Date | number): string {
  const date = new Date(input).getTime();
  const diffSeconds = (date - Date.now()) / 1000;
  const abs = Math.abs(diffSeconds);
  for (const [unit, sec] of UNITS) {
    if (abs >= sec || unit === 'second') {
      return RTF.format(Math.round(diffSeconds / sec), unit);
    }
  }
  return RTF.format(0, 'second');
}

export function formatTime(input: string | Date | number): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(input));
}

export function formatDateTime(input: string | Date | number): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(input));
}
