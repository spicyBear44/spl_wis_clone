const Group = require("../models/Group");
const Expense = require("../models/Expense");
const Settlement = require("../models/Settlement");
const User = require("../models/User");
const { buildSettlementSuggestions, recalculateGroupBalances } = require("../services/balanceService");

function normalizeMemberIds(memberIds = [], currentUserId) {
  const ids = new Set([currentUserId.toString()]);
  memberIds.forEach((id) => {
    if (id) ids.add(id.toString());
  });
  return [...ids];
}

async function listGroups(req, res) {
  const groups = await Group.find({ "members.user": req.user._id })
    .populate("members.user", "name username")
    .sort({ updatedAt: -1 });

  res.json(groups);
}

async function createGroup(req, res) {
  try {
    const { name, description, currency, memberIds } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Group name is required." });
    }

    const members = normalizeMemberIds(memberIds, req.user._id).map((id) => ({
      user: id
    }));

    const group = await Group.create({
      name,
      description,
      currency: currency || "USD",
      createdBy: req.user._id,
      members
    });

    const populated = await Group.findById(group._id).populate("members.user", "name username");
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: "Could not create group.", error: error.message });
  }
}

async function getGroupDetails(req, res) {
  try {
    const group = await Group.findOne({
      _id: req.params.groupId,
      "members.user": req.user._id
    }).populate("members.user", "name username");

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    const [expenses, settlements] = await Promise.all([
      Expense.find({ group: group._id })
        .populate("paidBy", "name username")
        .populate("splits.user", "name username")
        .sort({ expenseDate: -1, createdAt: -1 }),
      Settlement.find({ group: group._id })
        .populate("fromUser", "name username")
        .populate("toUser", "name username")
        .sort({ settledAt: -1, createdAt: -1 })
    ]);

    return res.json({
      group,
      expenses,
      settlements,
      suggestions: buildSettlementSuggestions(group)
    });
  } catch (error) {
    return res.status(500).json({ message: "Could not load group.", error: error.message });
  }
}

async function createExpense(req, res) {
  try {
    const { description, amount, paidBy, splits, category, expenseDate } = req.body;
    const group = await Group.findOne({
      _id: req.params.groupId,
      "members.user": req.user._id
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    if (!description || !amount || !paidBy || !Array.isArray(splits) || !splits.length) {
      return res.status(400).json({ message: "Description, amount, payer, and splits are required." });
    }

    const splitTotal = splits.reduce((sum, split) => sum + Number(split.amount || 0), 0);
    if (Math.abs(Number(amount) - splitTotal) > 0.01) {
      return res.status(400).json({ message: "Split amounts must equal the expense amount." });
    }

    const expense = await Expense.create({
      group: group._id,
      description,
      amount: Number(amount),
      paidBy,
      splits: splits.map((split) => ({
        user: split.user,
        amount: Number(split.amount)
      })),
      category: category || "General",
      expenseDate: expenseDate || new Date(),
      createdBy: req.user._id
    });

    const updatedGroup = await recalculateGroupBalances(group._id);
    req.app.get("io").to(group._id.toString()).emit("group:updated", { groupId: group._id.toString() });

    res.status(201).json({ expense, group: updatedGroup });
  } catch (error) {
    res.status(500).json({ message: "Could not add expense.", error: error.message });
  }
}

async function addGroupMember(req, res) {
  try {
    const { userId } = req.body;
    const group = await Group.findOne({
      _id: req.params.groupId,
      "members.user": req.user._id
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    if (!userId) {
      return res.status(400).json({ message: "A user is required." });
    }

    const userToAdd = await User.findById(userId).select("_id");
    if (!userToAdd) {
      return res.status(404).json({ message: "User not found." });
    }

    const alreadyMember = group.members.some((member) => member.user.toString() === userToAdd._id.toString());
    if (alreadyMember) {
      return res.status(409).json({ message: "That user is already in this group." });
    }

    group.members.push({ user: userToAdd._id, balance: 0 });
    await group.save();

    const populatedGroup = await Group.findById(group._id).populate("members.user", "name username");
    req.app.get("io").to(group._id.toString()).emit("group:updated", { groupId: group._id.toString() });

    return res.status(201).json(populatedGroup);
  } catch (error) {
    return res.status(500).json({ message: "Could not add user to group.", error: error.message });
  }
}

async function createSettlement(req, res) {
  try {
    const { fromUser, toUser, amount, note } = req.body;
    const group = await Group.findOne({
      _id: req.params.groupId,
      "members.user": req.user._id
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    if (!fromUser || !toUser || !amount) {
      return res.status(400).json({ message: "Payer, receiver, and amount are required." });
    }

    const settlement = await Settlement.create({
      group: group._id,
      fromUser,
      toUser,
      amount: Number(amount),
      note: note || ""
    });

    const updatedGroup = await recalculateGroupBalances(group._id);
    req.app.get("io").to(group._id.toString()).emit("group:updated", { groupId: group._id.toString() });

    res.status(201).json({ settlement, group: updatedGroup });
  } catch (error) {
    res.status(500).json({ message: "Could not record settlement.", error: error.message });
  }
}

module.exports = {
  listGroups,
  createGroup,
  getGroupDetails,
  createExpense,
  addGroupMember,
  createSettlement
};
