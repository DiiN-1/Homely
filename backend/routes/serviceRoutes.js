const express = require("express");
const Service = require("../models/Service");

const router = express.Router();

// GET /api/services  (public — supports ?category= and ?search=)
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

    const services = await Service.find(filter).sort({ createdAt: -1 });
    res.json(services);
  } catch (err) {
    next(err);
  }
});

// GET /api/services/:id  (public)
router.get("/:id", async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ message: "Service not found" });
    res.json(service);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
