require("dotenv").config();
const mongoose = require("mongoose");
const Service = require("../models/Service");
const Product = require("../models/Product");

const services = [
  {
    name: "Deep House Cleaning",
    category: "Cleaning",
    description: "Full home deep clean including kitchen, bathrooms, and living areas.",
    image: "",
    priceMin: 8000,
    priceMax: 20000,
    rating: 4.7,
  },
  {
    name: "Electrical Wiring Inspection",
    category: "Electrical",
    description: "Safety inspection and minor repairs for home wiring.",
    image: "",
    priceMin: 5000,
    priceMax: 15000,
    rating: 4.5,
  },
  {
    name: "Pipe Leak Repair",
    category: "Plumbing",
    description: "Fix leaking pipes, taps, and joints around the home.",
    image: "",
    priceMin: 3000,
    priceMax: 12000,
    rating: 4.6,
  },
  {
    name: "Custom Furniture Repair",
    category: "Carpentry",
    description: "Repair or build custom wooden furniture and fittings.",
    image: "",
    priceMin: 6000,
    priceMax: 25000,
    rating: 4.3,
  },
  {
    name: "Interior Wall Painting",
    category: "Painting",
    description: "Fresh coat of paint for interior walls, includes prep work.",
    image: "",
    priceMin: 10000,
    priceMax: 40000,
    rating: 4.8,
  },
  {
    name: "General Home Maintenance",
    category: "Maintenance",
    description: "Routine checks and small fixes across the home.",
    image: "",
    priceMin: 4000,
    priceMax: 18000,
    rating: 4.4,
  },
  {
    name: "AC Servicing & Repair",
    category: "Maintenance",
    description: "Cleaning, gas top-up, and repair for air conditioning units.",
    image: "",
    priceMin: 7000,
    priceMax: 22000,
    rating: 4.6,
  },
  {
    name: "Bathroom Deep Clean",
    category: "Cleaning",
    description: "Intensive cleaning and descaling for bathrooms.",
    image: "",
    priceMin: 4000,
    priceMax: 10000,
    rating: 4.5,
  },
];

const products = [
  {
    name: "Multi-Surface Cleaner (1L)",
    category: "Cleaning",
    description: "All-purpose cleaner safe for most household surfaces.",
    image: "",
    price: 2500,
  },
  {
    name: "LED Bulb Pack (4pcs)",
    category: "Electrical",
    description: "Energy-saving LED bulbs, cool white, 9W each.",
    image: "",
    price: 4000,
  },
  {
    name: "PVC Pipe Fitting Kit",
    category: "Plumbing",
    description: "Assorted fittings for common household plumbing repairs.",
    image: "",
    price: 6500,
  },
  {
    name: "Wood Varnish (500ml)",
    category: "Carpentry",
    description: "Protective varnish finish for wooden furniture.",
    image: "",
    price: 3200,
  },
  {
    name: "Interior Paint (4L, White)",
    category: "Painting",
    description: "Matte finish interior wall paint, washable.",
    image: "",
    price: 18000,
    },
  {
    name: "Tool Kit (32-piece)",
    category: "Maintenance",
    description: "General home repair tool kit with case.",
    image: "",
    price: 15000,
  },
  {
    name: "Extension Cable (5m)",
    category: "Electrical",
    description: "Heavy-duty extension cable with surge protection.",
    image: "",
    price: 5000,
  },
  {
    name: "Drain Unblocker (750ml)",
    category: "Plumbing",
    description: "Fast-acting liquid drain unblocker.",
    image: "",
    price: 2800,
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for seeding...");

    await Service.deleteMany();
    await Product.deleteMany();

    await Service.insertMany(services);
    await Product.insertMany(products);

    console.log("Seed complete: services and products inserted.");
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exit(1);
  }
}

seed();
