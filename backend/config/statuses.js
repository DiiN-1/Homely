// Allowed status changes an admin can make. Anything not listed here is rejected.

const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "processing",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "payment_failed",
];

const BOOKING_STATUSES = [
  "pending_payment",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "payment_failed",
];

const ORDER_TRANSITIONS = {
  paid: ["processing", "cancelled"],
  processing: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered"],
};

const BOOKING_TRANSITIONS = {
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
};

// Statuses where the customer may still cancel on their own (nothing paid yet)
const CUSTOMER_CANCELLABLE = ["pending_payment", "payment_failed"];

module.exports = {
  ORDER_STATUSES,
  BOOKING_STATUSES,
  ORDER_TRANSITIONS,
  BOOKING_TRANSITIONS,
  CUSTOMER_CANCELLABLE,
};