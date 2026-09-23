require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { authLimiter, generalLimiter } = require("./middleware/rateLimiter");

const authRoutes = require("./routes/authRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const productRoutes = require("./routes/productRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const orderRoutes = require("./routes/orderRoutes");

const app = express();

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        process.env.CLIENT_ORIGIN,
        "http://localhost:5500",
        "http://127.0.0.1:5500",
      ].filter(Boolean);

      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
  })
);
app.use(express.json());

// General rate limit across the whole API
app.use("/api", generalLimiter);

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/products", productRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/orders", orderRoutes);

// 404 
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
