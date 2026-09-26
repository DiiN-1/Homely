// One-off cleanup script.
//
// Your Homely `Booking` model has never had staffId/date/startTime fields —
// grep confirms nothing in this repo references them. The unique index
// "staffId_1_date_1_startTime_1" on the bookings collection is left over
// from a DIFFERENT project (almost certainly Bkly) that shares the same
// MongoDB Atlas cluster. Because your MONGO_URI has no database name in its
// path (it goes straight from the host to "?ssl=true&..."), Mongoose
// defaults to the "test" database — the same default Bkly's connection
// would fall back to if it *also* has no db name set. Two apps, one
// physical database, one "bookings" collection, one leftover index.
//
// Since Homely's booking docs have no staffId/date/startTime, Mongo treats
// all three as null for indexing — and a UNIQUE index only allows one
// document with that combination. First booking succeeds, every booking
// after it collides on { staffId: null, date: null, startTime: null }.
//
// This script drops that one bad index. Run it once:
//   node backend/scripts/dropStaleBookingIndex.js
//
// Then see the note at the bottom of this file about giving Homely its own
// database name so this can't happen again.

require("dotenv").config();
const mongoose = require("mongoose");

const INDEX_NAME = "staffId_1_date_1_startTime_1";

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB...");

    const collection = mongoose.connection.db.collection("bookings");
    const indexes = await collection.indexes();
    const match = indexes.find((index) => index.name === INDEX_NAME);

    if (!match) {
      console.log(`No index named "${INDEX_NAME}" found — nothing to drop.`);
      console.log(
        "Existing indexes:",
        indexes.map((i) => i.name)
      );
    } else {
      await collection.dropIndex(INDEX_NAME);
      console.log(`Dropped index "${INDEX_NAME}" from bookings collection.`);
    }

    process.exit(0);
  } catch (err) {
    console.error("Failed to drop index:", err.message);
    process.exit(1);
  }
}

run();

// ---------------------------------------------------------------------
// To stop this from happening again: give Homely its own database name
// instead of sharing Atlas's default "test" db with your other project.
// In backend/.env, change the MONGO_URI so a db name sits right after the
// host list and before the "?":
//
//   mongodb://user:pass@host1:27017,host2:27017,host3:27017/homely?ssl=true&...
//                                                            ^^^^^^^
//
// Then re-run `npm run seed` once against the new database (it starts
// empty, so you'll need to seed it) and everything Homely writes — users,
// services, products, bookings, orders — lives in its own "homely"
// database, fully isolated from Bkly's collections and indexes.
// ---------------------------------------------------------------------