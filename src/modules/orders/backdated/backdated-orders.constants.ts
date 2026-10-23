/** The shop runs in Vietnam, which has no daylight saving, so a fixed offset is exact. */
export const SHOP_UTC_OFFSET = '+07:00';
/** Wall-clock time used when a backdated order has a day but no time. */
export const DEFAULT_ORDER_TIME = '12:00';
export const BACKDATED_MAX_ORDERS = 200;
export const BACKDATED_MAX_ITEMS_PER_ORDER = 50;
