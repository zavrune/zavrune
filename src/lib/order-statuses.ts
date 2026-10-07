/** Order lifecycle statuses accepted by the admin API. */
export const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
  "Refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
