const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { protect } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { orderSchema } = require("../validation/schemas");
const { deliveryFeeFor } = require("../config/pricing");
const { CUSTOMER_CANCELLABLE } = require("../config/statuses");
const { startPayment, verifyHandler } = require("../services/payment");

const router = express.Router();

// All order routes require login
router.use(protect);

const MAX_PER_ITEM = 10;

// POST /api/orders — create an order from the cart and start a Paystack payment
router.post("/", validate(orderSchema), async (req, res, next) => {
  try {
    const { items, deliveryAddress, notes } = req.body;

    // Merge duplicate lines (same product twice) and validate ids
    const quantityById = new Map();
    for (const item of items) {
      if (!mongoose.Types.ObjectId.isValid(item.productId)) {
        return res.status(400).json({ message: "Invalid product id — try refreshing the page." });
      }
      const current = quantityById.get(item.productId) || 0;
      quantityById.set(item.productId, Math.min(current + item.quantity, MAX_PER_ITEM));
    }

    // Prices come from the database, never from the browser
    const products = await Product.find({ _id: { $in: [...quantityById.keys()] } });
    if (products.length !== quantityById.size) {
      return res.status(404).json({
        message: "One or more items in your cart are no longer available. Please refresh and try again.",
      });
    }

    const orderItems = products.map((product) => ({
      product: product._id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: quantityById.get(String(product._id)),
    }));

    const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const deliveryFee = deliveryFeeFor(deliveryAddress.state, subtotal);

    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      deliveryAddress,
      notes,
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      status: "pending_payment",
      statusHistory: [{ status: "pending_payment", note: "Order placed" }],
    });

    let authorizationUrl;
    try {
      authorizationUrl = await startPayment("order", order, req.user, req);
    } catch (paymentError) {
      // Don't leave a dead order behind if Paystack couldn't start
      await order.deleteOne();
      throw paymentError;
    }

    res.status(201).json({ order, authorizationUrl });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/mine — logged-in user's orders
router.get("/mine", async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/verify/:reference — confirm a Paystack payment after redirect
router.get("/verify/:reference", verifyHandler("order"));

// GET /api/orders/:id — one order (owner only)
router.get("/:id", async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/:id/pay — retry payment for an unpaid order
router.post("/:id/pay", async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
      return res.status(400).json({ message: "This order can't be paid for right now." });
    }

    if (order.status === "payment_failed") {
      order.status = "pending_payment";
      order.statusHistory.push({ status: "pending_payment", note: "Payment retry" });
    }

    const authorizationUrl = await startPayment("order", order, req.user, req);
    res.json({ order, authorizationUrl });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/:id/cancel — customers can cancel until they've paid
router.post("/:id/cancel", async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
      return res.status(400).json({
        message: "This order has already been paid for. Please contact support to cancel it.",
      });
    }

    order.status = "cancelled";
    order.statusHistory.push({ status: "cancelled", note: "Cancelled by customer" });
    await order.save();
    res.json(order);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
