const express = require("express");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Service = require("../models/Service");
const { protect } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { bookingSchema } = require("../validation/schemas");
const { BOOKING_FEE } = require("../config/pricing");
const { CUSTOMER_CANCELLABLE } = require("../config/statuses");
const { startPayment, verifyHandler } = require("../services/payment");

const router = express.Router();

// All booking routes require login
router.use(protect);

// POST /api/bookings — create a booking and start payment of the booking fee
router.post("/", validate(bookingSchema), async (req, res, next) => {
  try {
    const { serviceId, preferredDate, timeSlot, phone, address, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ message: "Invalid service id — try refreshing the page." });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    const booking = await Booking.create({
      user: req.user._id,
      service: serviceId,
      serviceName: service.name,
      preferredDate,
      timeSlot,
      phone,
      address,
      notes,
      bookingFee: BOOKING_FEE,
      status: "pending_payment",
      statusHistory: [{ status: "pending_payment", note: "Booking requested" }],
    });

    let authorizationUrl;
    try {
      authorizationUrl = await startPayment("booking", booking, req.user, req);
    } catch (paymentError) {
      await booking.deleteOne();
      throw paymentError;
    }

    res.status(201).json({ booking, authorizationUrl });
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings/mine — logged-in user's bookings
router.get("/mine", async (req, res, next) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate("service", "name category priceMin priceMax rating")
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings/verify/:reference — confirm a Paystack payment after redirect
router.get("/verify/:reference", verifyHandler("booking"));

// POST /api/bookings/:id/pay — retry paying the booking fee
router.post("/:id/pay", async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (!CUSTOMER_CANCELLABLE.includes(booking.status)) {
      return res.status(400).json({ message: "This booking can't be paid for right now." });
    }

    if (booking.status === "payment_failed") {
      booking.status = "pending_payment";
      booking.statusHistory.push({ status: "pending_payment", note: "Payment retry" });
    }

    const authorizationUrl = await startPayment("booking", booking, req.user, req);
    res.json({ booking, authorizationUrl });
  } catch (err) {
    next(err);
  }
});

// POST /api/bookings/:id/cancel — customers can cancel until the fee is paid
router.post("/:id/cancel", async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (!CUSTOMER_CANCELLABLE.includes(booking.status)) {
      return res.status(400).json({
        message: "This booking is already confirmed. Please contact support to change or cancel it.",
      });
    }

    booking.status = "cancelled";
    booking.statusHistory.push({ status: "cancelled", note: "Cancelled by customer" });
    await booking.save();
    res.json(booking);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
