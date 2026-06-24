/** Parseo mínimo de la cabecera Cookie (evita depender de cookie-parser). */
export function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1) {
      const k = part.slice(0, i).trim();
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    }
  }
  return out;
}

export const AUTH_COOKIE = 'prexi_token';
