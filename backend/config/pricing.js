// Central place for money rules. The server is the only source of truth for
// prices, fees and totals — the browser never sends an amount.

const BOOKING_FEE = 2000; // ₦ call-out / booking fee charged when a service is booked

const DELIVERY = {
  homeState: "Rivers", // cheaper delivery inside Rivers State (Port Harcourt)
  homeFee: 1500,
  otherFee: 3500,
  freeAbove: 50000, // orders with a subtotal at/above this ship free
};

function deliveryFeeFor(state, subtotal) {
  if (subtotal >= DELIVERY.freeAbove) return 0;
  const isHome =
    String(state || "").trim().toLowerCase() === DELIVERY.homeState.toLowerCase();
  return isHome ? DELIVERY.homeFee : DELIVERY.otherFee;
}

module.exports = { BOOKING_FEE, DELIVERY, deliveryFeeFor };