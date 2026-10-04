import { parseCookie } from 'cookie';

export function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  return header ? parseCookie(header)[name] : undefined;
}
