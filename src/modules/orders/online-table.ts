/** Orders for the table named "Online" (trim, case-insensitive) are delivery orders. */
export const isOnlineTable = (name: string | null | undefined): boolean =>
  name?.trim().toLowerCase() === 'online';
