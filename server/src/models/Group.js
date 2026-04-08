const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    nickname: {
      type: String,
      trim: true
    },
    balance: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    currency: {
      type: String,
      default: "USD"
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    members: [memberSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Group", groupSchema);
