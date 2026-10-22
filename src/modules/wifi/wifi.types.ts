import type { WifiSecurity } from '../../database/enums.js';

/** What the API returns: never the password and never the S3 key. */
export interface WifiView {
  id: string;
  ssid: string;
  security: WifiSecurity;
  hidden: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
