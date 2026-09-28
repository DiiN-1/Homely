const crypto = require("crypto");
const Order = require("../models/Order");
const Booking = require("../models/Booking");
const paystack = require("../utils/paystack");

// What "paid" means for each kind of thing a customer can pay for.
const KINDS = {
  order: {
    Model: Order,
    prefix: "HML-ORD",
    paidStatus: "paid",
    amountOf: (doc) => doc.total,
    responseKey: "order",
  },
  booking: {
    Model: Booking,
    prefix: "HML-BKG",
    paidStatus: "confirmed",
    amountOf: (doc) => doc.bookingFee,
    responseKey: "booking",
  },
};

// Paystack redirects back to the same site the customer started from.
function callbackBase(req) {
  return req.headers.origin || process.env.CLIENT_ORIGIN || "http://127.0.0.1:5500";
}

// Creates a fresh Paystack transaction for an order/booking and returns the
// hosted checkout URL to send the customer to.
async function startPayment(kind, doc, user, req) {
  const cfg = KINDS[kind];
  const reference = `${cfg.prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`.toUpperCase();

  // Save the reference first so a webhook can never arrive for an unknown reference.
  doc.paymentReference = reference;
  doc.paymentReferences.push(reference);
  await doc.save();

  const data = await paystack.initializeTransaction({
    email: user.email,
    amountNaira: cfg.amountOf(doc),
    reference,
    callbackUrl: `${callbackBase(req)}/payment-callback.html?type=${kind}`,
    metadata: { kind, id: String(doc._id) },
  });
  return data.authorization_url;
}

// Applies a Paystack transaction result to our record. Safe to call many times
// (verify endpoint + webhook can both fire) — the atomic update means a
// payment is only ever recorded once.
async function settlePayment(kind, doc, tx) {
  const { Model, paidStatus, amountOf } = KINDS[kind];
  if (doc.paymentStatus === "paid") return doc;

  if (tx.status === "success") {
    const expected = Math.round(amountOf(doc) * 100);
    if (tx.amount !== expected || tx.currency !== "NGN") {
      console.error(
        `Payment mismatch on ${tx.reference}: expected ${expected} NGN kobo, got ${tx.amount} ${tx.currency}`
      );
      const err = new Error(
        "The amount paid doesn't match this order. Please contact support with your payment reference."
      );
      err.status = 409;
      throw err;
    }

    // Customer cancelled while paying: record the money but don't resurrect it.
    const wasCancelled = doc.status === "cancelled";
    const update = wasCancelled
      ? {
          $set: { paymentStatus: "paid", paidAt: new Date() },
          $push: {
            statusHistory: {
              status: "cancelled",
              note: "Payment received after cancellation — refund required",
              at: new Date(),
            },
          },
        }
      : {
          $set: { paymentStatus: "paid", paidAt: new Date(), status: paidStatus },
          $push: {
            statusHistory: { status: paidStatus, note: "Payment received via Paystack", at: new Date() },
          },
        };

    const updated = await Model.findOneAndUpdate(
      { _id: doc._id, paymentStatus: { $ne: "paid" } },
      update,
      { new: true }
    );
    return updated || Model.findById(doc._id);
  }

  if (tx.status === "failed" || tx.status === "reversed") {
    const updated = await Model.findOneAndUpdate(
      { _id: doc._id, paymentStatus: { $ne: "paid" }, status: "pending_payment" },
      {
        $set: { paymentStatus: "failed", status: "payment_failed" },
        $push: {
          statusHistory: { status: "payment_failed", note: "Payment was not successful", at: new Date() },
        },
      },
      { new: true }
    );
    return updated || Model.findById(doc._id);
  }

  // "abandoned" / "ongoing": customer hasn't finished — leave it unpaid so they can retry.
  return doc;
}

// GET /verify/:reference handler, shared by orders and bookings.
function verifyHandler(kind) {
  const { Model, responseKey } = KINDS[kind];
  return async (req, res, next) => {
    try {
      const doc = await Model.findOne({
        paymentReferences: req.params.reference,
        user: req.user._id,
      });
      if (!doc) return res.status(404).json({ message: "We couldn't find a payment with that reference." });

      if (doc.paymentStatus === "paid") {
        return res.json({ [responseKey]: doc, paymentStatus: "success" });
      }

      const tx = await paystack.verifyTransaction(req.params.reference);
      const updated = await settlePayment(kind, doc, tx);
      res.json({ [responseKey]: updated, paymentStatus: tx.status });
    } catch (err) {
      next(err);
    }
  };
}

// Used by the webhook: find whichever record owns this reference.
async function findByReference(reference) {
  let doc = await Order.findOne({ paymentReferences: reference });
  if (doc) return { kind: "order", doc };
  doc = await Booking.findOne({ paymentReferences: reference });
  if (doc) return { kind: "booking", doc };
  return null;
}

module.exports = { startPayment, settlePayment, verifyHandler, findByReference };
