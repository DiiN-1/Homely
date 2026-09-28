const express = require("express");
const Order = require("../models/Order");
const Booking = require("../models/Booking");
const { protect, adminOnly } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { statusUpdateSchema } = require("../validation/schemas");
const { ORDER_TRANSITIONS, BOOKING_TRANSITIONS } = require("../config/statuses");

const router = express.Router();

router.use(protect, adminOnly);

// GET /api/admin/orders
router.get("/orders", async (req, res, next) => {
  try {
    const orders = await Order.find().populate("user", "name email").sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/bookings
router.get("/bookings", async (req, res, next) => {
  try {
    const bookings = await Booking.find()
      .populate("user", "name email")
      .populate("service", "name category")
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    next(err);
  }
});

function statusUpdater(Model, transitions, label) {
  return async (req, res, next) => {
    try {
      const { status, note } = req.body;
      const doc = await Model.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: `${label} not found` });

      const allowed = transitions[doc.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          message: allowed.length
            ? `A ${doc.status.replace(/_/g, " ")} ${label} can only move to: ${allowed.join(", ").replace(/_/g, " ")}.`
            : `A ${doc.status.replace(/_/g, " ")} ${label} can't be changed.`,
        });
      }

      doc.status = status;
      doc.statusHistory.push({ status, note: note || "" });
      await doc.save();
      res.json(doc);
    } catch (err) {
      next(err);
    }
  };
}

// PATCH /api/admin/orders/:id/status
router.patch("/orders/:id/status", validate(statusUpdateSchema), statusUpdater(Order, ORDER_TRANSITIONS, "order"));

// PATCH /api/admin/bookings/:id/status
router.patch("/bookings/:id/status", validate(statusUpdateSchema), statusUpdater(Booking, BOOKING_TRANSITIONS, "booking"));

module.exports = router;
