import { WifiSecurity } from '../../database/enums.js';

export interface WifiCredentials {
  ssid: string;
  password?: string;
  security: WifiSecurity;
  hidden?: boolean;
}

/** `\ ; , : "` are field delimiters in the WIFI: payload and must be backslash-escaped. */
const escapeField = (v: string) => v.replace(/[\\;,:"]/g, (c) => `\\${c}`);

/** The de-facto standard `WIFI:T:WPA;S:ssid;P:pass;H:true;;` string phones scan to join a network. */
export function buildWifiPayload(c: WifiCredentials): string {
  const parts = [`T:${c.security}`, `S:${escapeField(c.ssid)}`];
  if (c.security !== WifiSecurity.OPEN) parts.push(`P:${escapeField(c.password ?? '')}`);
  if (c.hidden) parts.push('H:true');
  return `WIFI:${parts.join(';')};;`;
}
