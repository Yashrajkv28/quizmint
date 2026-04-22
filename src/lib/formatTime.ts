export interface TimeParts {
  h: number;
  m: number;
  s: number;
}

export function secondsToParts(total: number): TimeParts {
  const abs = Math.max(0, Math.floor(total));
  return {
    h: Math.floor(abs / 3600),
    m: Math.floor((abs % 3600) / 60),
    s: abs % 60,
  };
}
