// Usage: npm run make-admin -- you@example.com
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

async function run() {
  const email = (process.argv[2] || "").toLowerCase().trim();
  if (!email) {
    console.error("Usage: npm run make-admin -- you@example.com");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOneAndUpdate({ email }, { role: "admin" }, { new: true });
  if (!user) {
    console.error(`No user found with email ${email}. Register that account first.`);
    process.exit(1);
  }
  console.log(`${user.email} is now an admin. Sign out and back in to pick up the change.`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
