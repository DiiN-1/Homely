const express = require("express");
const Product = require("../models/Product");

const router = express.Router();

// GET /api/products  (public — supports ?category= and ?search=)
router.get("/", async (req, res, next) => {
  try {
    const { category, search } = req.query;
    const filter = {};

    if (category && category !== "All") {
      filter.category = category;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id  (public)
router.get("/:id", async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
