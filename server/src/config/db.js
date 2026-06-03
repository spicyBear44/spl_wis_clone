const mongoose = require("mongoose");
const User = require("../models/User");

function isCurrentEmailIndex(index) {
  return (
    index.key?.email === 1 &&
    index.unique === true &&
    index.partialFilterExpression?.email?.$type === "string"
  );
}

async function ensureEmailIndex() {
  const indexes = await User.collection.indexes();
  const emailIndex = indexes.find((index) => index.name === "email_1" || index.key?.email === 1);

  if (emailIndex && !isCurrentEmailIndex(emailIndex)) {
    await User.collection.dropIndex(emailIndex.name);
  }

  if (!emailIndex || !isCurrentEmailIndex(emailIndex)) {
    await User.collection.createIndex(
      { email: 1 },
      {
        unique: true,
        partialFilterExpression: { email: { $type: "string" } },
        name: "email_1"
      }
    );
  }
}

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not set.");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  await ensureEmailIndex();
}

module.exports = { connectDatabase };
