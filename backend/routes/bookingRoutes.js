const express = require("express");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Service = require("../models/Service");
const { protect } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { bookingSchema } = require("../validation/schemas");

const router = express.Router();

// All booking routes require login
router.use(protect);

// POST /api/bookings
router.post("/", validate(bookingSchema), async (req, res, next) => {
  try {
    const { serviceId, preferredDate, notes } = req.body;

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
      preferredDate,
      notes,
    });

    res.status(201).json(booking);
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

module.exports = router;