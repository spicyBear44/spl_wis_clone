const mongoose = require("mongoose");
const User = require("../models/User");

async function dropLegacyEmailIndex() {
  const indexes = await User.collection.indexes();
  const legacyEmailIndex = indexes.find(
    (index) => index.name === "email_1" || (index.key && index.key.email === 1)
  );

  if (!legacyEmailIndex) {
    return;
  }

  await User.collection.dropIndex(legacyEmailIndex.name);
}

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not set.");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  await dropLegacyEmailIndex();
}

module.exports = { connectDatabase };
