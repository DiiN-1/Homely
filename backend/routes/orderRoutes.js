const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { protect } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { orderSchema } = require("../validation/schemas");

const router = express.Router();

// All order routes require login
router.use(protect);

// POST /api/orders
router.post("/", validate(orderSchema), async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product id — try refreshing the page." });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const order = await Order.create({
      user: req.user._id,
      product: productId,
      quantity: quantity || 1,
    });

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/mine — logged-in user's orders
router.get("/mine", async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate("product", "name price category")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

module.exports = router;