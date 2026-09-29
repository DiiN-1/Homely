// Thin wrapper around the Paystack REST API (Node 18+ has global fetch).
// Docs: https://paystack.com/docs/api/transaction/

const BASE_URL = "https://api.paystack.co";

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    const err = new Error("Payments are not configured yet (missing PAYSTACK_SECRET_KEY).");
    err.status = 500;
    throw err;
  }
  return key;
}

async function call(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        "Content-Type": "application/json",
      },
    });
  } catch (networkError) {
    const err = new Error("Could not reach Paystack. Please try again.");
    err.status = 502;
    throw err;
  }

  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.status) {
    const err = new Error(json.message || "Paystack request failed.");
    err.status = 502;
    throw err;
  }
  return json.data;
}

// amountNaira is in naira; Paystack wants kobo (₦1 = 100 kobo)
function initializeTransaction({ email, amountNaira, reference, callbackUrl, metadata }) {
  return call("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email,
      amount: Math.round(amountNaira * 100),
      currency: "NGN",
      reference,
      callback_url: callbackUrl,
      metadata,
    }),
  });
}

function verifyTransaction(reference) {
  return call(`/transaction/verify/${encodeURIComponent(reference)}`);
}

module.exports = { initializeTransaction, verifyTransaction };