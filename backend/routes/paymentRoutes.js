const crypto = require("crypto");
const { findByReference, settlePayment } = require("../services/payment");

// POST /api/payments/webhook — Paystack calls this itself when a payment succeeds,
// even if the customer closes the tab before being redirected back.
// server.js mounts it with express.raw() because the signature is computed
// over the exact bytes Paystack sent.
async function paystackWebhook(req, res) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const signature = req.headers["x-paystack-signature"];
  if (!secret || !signature || !Buffer.isBuffer(req.body)) {
    return res.sendStatus(400);
  }

  const expected = crypto.createHmac("sha512", secret).update(req.body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.sendStatus(401);
  }

  // Acknowledge fast; Paystack retries if it doesn't get a 200
  res.sendStatus(200);

  try {
    const event = JSON.parse(req.body.toString("utf8"));
    if (event.event !== "charge.success") return;

    const found = await findByReference(event.data.reference);
    if (!found) return console.warn(`Webhook: unknown reference ${event.data.reference}`);

    await settlePayment(found.kind, found.doc, event.data);
  } catch (err) {
    console.error("Webhook processing error:", err.message);
  }
}

module.exports = { paystackWebhook };
