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

// Nigerian mobile numbers: 08012345678, 8012345678 with +234/234 prefix, spaces/dashes allowed
const phoneSchema = z
  .string()
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .refine((value) => /^(?:\+234|234|0)[789][01]\d{8}$/.test(value), {
    message: "Enter a valid Nigerian phone number, e.g. 0801 234 5678",
  });

const addressFields = {
  street: z.string().trim().min(5, "Enter your street address"),
  city: z.string().trim().min(2, "City is required"),
  state: z.string().trim().min(2, "State is required"),
  landmark: z.string().trim().max(120).optional().default(""),
};

const bookingSchema = z.object({
  serviceId: z.string().min(1, "serviceId is required"),
  preferredDate: z.coerce
    .date({ required_error: "Preferred date is required", invalid_type_error: "Pick a valid date" })
    .refine(
      (date) => {
        const startOfTodayUtc = new Date();
        startOfTodayUtc.setUTCHours(0, 0, 0, 0);
        return date >= startOfTodayUtc;
      },
      { message: "Preferred date can't be in the past" }
    ),
  timeSlot: z.enum(["morning", "afternoon", "evening"], {
    errorMap: () => ({ message: "Choose a time slot" }),
  }),
  phone: phoneSchema,
  address: z.object(addressFields),
  notes: z.string().trim().max(500).optional(),
});

const orderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "productId is required"),
        quantity: z.coerce.number().int().min(1).max(10, "You can order at most 10 of one item"),
      })
    )
    .min(1, "Your cart is empty")
    .max(20, "Too many different items in one order"),
  deliveryAddress: z.object({
    fullName: z.string().trim().min(2, "Full name is required"),
    phone: phoneSchema,
    ...addressFields,
  }),
  notes: z.string().trim().max(300).optional().default(""),
});

const statusUpdateSchema = z.object({
  status: z.string().min(1, "status is required"),
  note: z.string().trim().max(200).optional(),
});

module.exports = {
  registerSchema,
  loginSchema,
  bookingSchema,
  orderSchema,
  statusUpdateSchema,
};
