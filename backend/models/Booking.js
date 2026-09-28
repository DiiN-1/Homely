const mongoose = require("mongoose");
const { BOOKING_STATUSES } = require("../config/statuses");

const statusEntrySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    serviceName: { type: String, default: "" }, // snapshot, survives service edits

    preferredDate: { type: Date, required: true },
    timeSlot: { type: String, enum: ["morning", "afternoon", "evening"], required: true },
    phone: { type: String, required: true, trim: true },
    address: {
      street: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      landmark: { type: String, trim: true, default: "" },
    },
    notes: { type: String, trim: true },

    bookingFee: { type: Number, required: true },
    status: { type: String, enum: BOOKING_STATUSES, default: "pending_payment" },
    statusHistory: { type: [statusEntrySchema], default: [] },

    paymentStatus: { type: String, enum: ["unpaid", "paid", "failed"], default: "unpaid" },
    paymentReference: { type: String, default: "" },
    paymentReferences: { type: [String], default: [], index: true },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
