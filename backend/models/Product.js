const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    image: { type: String, default: "" },
    price: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
