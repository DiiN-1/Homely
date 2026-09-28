const mongoose = require("mongoose");
const crypto = require("crypto");
const { ORDER_STATUSES } = require("../config/statuses");

// Product details are copied onto the order at purchase time, so later price
// changes (or a deleted product) never rewrite order history.
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    image: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const deliveryAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    landmark: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const statusEntrySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      default: () => `HML-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [orderItemSchema], validate: (v) => v.length > 0 },
    deliveryAddress: { type: deliveryAddressSchema, required: true },
    notes: { type: String, trim: true, default: "" },

    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    total: { type: Number, required: true },

    status: { type: String, enum: ORDER_STATUSES, default: "pending_payment" },
    statusHistory: { type: [statusEntrySchema], default: [] },

    paymentStatus: { type: String, enum: ["unpaid", "paid", "failed"], default: "unpaid" },
    paymentReference: { type: String, default: "" }, // latest attempt
    paymentReferences: { type: [String], default: [], index: true }, // every attempt
    paidAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
