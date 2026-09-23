const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: [
        "Cleaning",
        "Electrical",
        "Plumbing",
        "Carpentry",
        "Painting",
        "Maintenance",
      ],
    },
    description: { type: String, required: true },
    image: { type: String, default: "" },
    priceMin: { type: Number, required: true },
    priceMax: { type: Number, required: true },
    rating: { type: Number, min: 0, max: 5, default: 4.5 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Service", serviceSchema);
