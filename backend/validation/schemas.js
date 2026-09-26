const { z } = require("zod");

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().trim().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

const bookingSchema = z.object({
  serviceId: z.string().min(1, "serviceId is required"),
  preferredDate: z.coerce.date({ required_error: "Preferred date is required" }),
  notes: z.string().trim().optional(),
});

const orderSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  quantity: z.coerce.number().int().min(1).optional(),
});

module.exports = {
  registerSchema,
  loginSchema,
  bookingSchema,
  orderSchema,
};