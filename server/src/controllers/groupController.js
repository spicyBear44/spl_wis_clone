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

function isGroupMember(group, userId) {
  return group.members.some((member) => member.user.toString() === userId.toString());
}

function serializeUser(user) {
  if (!user) {
    return {
      _id: "missing-user",
      name: "Unknown user",
      username: "unknown"
    };
  }

  return {
    _id: user._id,
    name: user.name,
    username: user.username,
    profilePhoto: user.profilePhoto || "",
    profilePicture: user.profilePhoto || ""
  };
}

function serializeGroup(group) {
  const plainGroup = group.toObject ? group.toObject() : group;

  return {
    ...plainGroup,
    members: (plainGroup.members || [])
      .filter((member) => member.user)
      .map((member) => ({
        ...member,
        user: serializeUser(member.user)
      }))
  };
}

function serializeExpense(expense) {
  const plainExpense = expense.toObject ? expense.toObject() : expense;

  return {
    ...plainExpense,
    paidBy: serializeUser(plainExpense.paidBy),
    splits: (plainExpense.splits || [])
      .filter((split) => split.user)
      .map((split) => ({
        ...split,
        user: serializeUser(split.user)
      }))
  };
}

function serializeSettlement(settlement) {
  const plainSettlement = settlement.toObject ? settlement.toObject() : settlement;

  return {
    ...plainSettlement,
    fromUser: serializeUser(plainSettlement.fromUser),
    toUser: serializeUser(plainSettlement.toUser)
  };
}

function buildSafeSettlementSuggestions(group) {
  return buildSettlementSuggestions(group).filter((suggestion) => suggestion.from && suggestion.to);
}

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function validateExpensePayload(group, payload) {
  const { description, amount, paidBy, splits, splitType, menuAmount } = payload;

  if (!description || !amount || !paidBy || !Array.isArray(splits) || !splits.length) {
    return { error: "Description, amount, payer, and splits are required." };
  }

  const expenseAmount = Number(amount);
  if (!Number.isFinite(expenseAmount) || expenseAmount <= 0) {
    return { error: "Expense amount must be greater than 0." };
  }

  if (!isGroupMember(group, paidBy)) {
    return { error: "Payer must be a member of this group." };
  }

  const invalidSplit = splits.some((split) => {
    const splitAmount = Number(split.amount);
    const itemAmount = split.itemAmount === undefined ? 0 : Number(split.itemAmount);
    return (
      !split.user ||
      !isGroupMember(group, split.user) ||
      !Number.isFinite(splitAmount) ||
      splitAmount < 0 ||
      !Number.isFinite(itemAmount) ||
      itemAmount < 0
    );
  });
  if (invalidSplit) {
    return { error: "Splits must use group members and non-negative amounts." };
  }

  const splitTotal = splits.reduce((sum, split) => sum + Number(split.amount || 0), 0);
  if (Math.abs(expenseAmount - splitTotal) > 0.01) {
    return { error: "Split amounts must equal the expense amount." };
  }

  if (splitType === "exact") {
    const itemSubtotalCents = splits.reduce((sum, split) => sum + toCents(split.itemAmount), 0);
    const menuAmountCents = toCents(menuAmount);

    // Exact split itemAmount is the pre-tax subtotal. Tax/tip are included in amount,
    // but itemAmount must still add up to the original bill subtotal.
    if (itemSubtotalCents !== menuAmountCents) {
      return { error: "Exact item amounts must equal the subtotal before tax and tip." };
    }
  }

  return { expenseAmount };
}

async function listGroups(req, res) {
  const groups = await Group.find({ "members.user": req.user._id })
    .populate("members.user", "name username profilePhoto")
    .sort({ updatedAt: -1 });

  res.json(groups.map(serializeGroup));
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

    const populated = await Group.findById(group._id).populate("members.user", "name username profilePhoto");
    res.status(201).json(serializeGroup(populated));
  } catch (error) {
    res.status(500).json({ message: "Could not create group.", error: error.message });
  }
}

async function getGroupDetails(req, res) {
  try {
    const group = await Group.findOne({
      _id: req.params.groupId,
      "members.user": req.user._id
    }).populate("members.user", "name username profilePhoto");

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    const [expenses, settlements] = await Promise.all([
      Expense.find({ group: group._id })
        .populate("paidBy", "name username profilePhoto")
        .populate("splits.user", "name username profilePhoto")
        .sort({ expenseDate: -1, createdAt: -1 }),
      Settlement.find({ group: group._id })
        .populate("fromUser", "name username profilePhoto")
        .populate("toUser", "name username profilePhoto")
        .sort({ settledAt: -1, createdAt: -1 })
    ]);

    return res.json({
      group: serializeGroup(group),
      expenses: expenses.map(serializeExpense),
      settlements: settlements.map(serializeSettlement),
      suggestions: buildSafeSettlementSuggestions(group)
    });
  } catch (error) {
    return res.status(500).json({ message: "Could not load group.", error: error.message });
  }
}

async function createExpense(req, res) {
  try {
    const { description, paidBy, splits, category, expenseDate, splitType, menuAmount, taxAmount, tipAmount } = req.body;
    const group = await Group.findOne({
      _id: req.params.groupId,
      "members.user": req.user._id
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    const validation = validateExpensePayload(group, req.body);
    if (validation.error) return res.status(400).json({ message: validation.error });

    const expense = await Expense.create({
      group: group._id,
      description: description.trim(),
      amount: Number(validation.expenseAmount.toFixed(2)),
      menuAmount: Number(Number(menuAmount || validation.expenseAmount).toFixed(2)),
      taxAmount: Number(Number(taxAmount || 0).toFixed(2)),
      tipAmount: Number(Number(tipAmount || 0).toFixed(2)),
      paidBy,
      splits: splits.map((split) => ({
        user: split.user,
        itemAmount: Number(Number(split.itemAmount || 0).toFixed(2)),
        amount: Number(Number(split.amount).toFixed(2))
      })),
      category: category || "General",
      splitType: splitType === "exact" ? "exact" : "equal",
      expenseDate: expenseDate || new Date(),
      createdBy: req.user._id
    });

    const updatedGroup = await recalculateGroupBalances(group._id);
    req.app.get("io").to(group._id.toString()).emit("group:updated", { groupId: group._id.toString() });

    res.status(201).json({ expense, group: serializeGroup(updatedGroup) });
  } catch (error) {
    res.status(500).json({ message: "Could not add expense.", error: error.message });
  }
}

async function updateExpense(req, res) {
  try {
    const { description, paidBy, splits, category, expenseDate, splitType, menuAmount, taxAmount, tipAmount } = req.body;
    const group = await Group.findOne({
      _id: req.params.groupId,
      "members.user": req.user._id
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    const expense = await Expense.findOne({ _id: req.params.expenseId, group: group._id });
    if (!expense) {
      return res.status(404).json({ message: "Expense not found." });
    }

    const validation = validateExpensePayload(group, req.body);
    if (validation.error) return res.status(400).json({ message: validation.error });

    expense.description = description.trim();
    expense.amount = Number(validation.expenseAmount.toFixed(2));
    expense.menuAmount = Number(Number(menuAmount || validation.expenseAmount).toFixed(2));
    expense.taxAmount = Number(Number(taxAmount || 0).toFixed(2));
    expense.tipAmount = Number(Number(tipAmount || 0).toFixed(2));
    expense.paidBy = paidBy;
    expense.splits = splits.map((split) => ({
      user: split.user,
      itemAmount: Number(Number(split.itemAmount || 0).toFixed(2)),
      amount: Number(Number(split.amount).toFixed(2))
    }));
    expense.category = category || "General";
    expense.splitType = splitType === "exact" ? "exact" : "equal";
    expense.expenseDate = expenseDate || expense.expenseDate;
    await expense.save();

    const updatedGroup = await recalculateGroupBalances(group._id);
    req.app.get("io").to(group._id.toString()).emit("group:updated", { groupId: group._id.toString() });

    return res.json({ expense, group: serializeGroup(updatedGroup) });
  } catch (error) {
    return res.status(500).json({ message: "Could not update expense.", error: error.message });
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

    const populatedGroup = await Group.findById(group._id).populate("members.user", "name username profilePhoto");
    req.app.get("io").to(group._id.toString()).emit("group:updated", { groupId: group._id.toString() });

    return res.status(201).json(serializeGroup(populatedGroup));
  } catch (error) {
    return res.status(500).json({ message: "Could not add user to group.", error: error.message });
  }
}

async function updateGroupMembers(req, res) {
  try {
    const { memberIds } = req.body;
    const group = await Group.findOne({
      _id: req.params.groupId,
      "members.user": req.user._id
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }
    if (!Array.isArray(memberIds)) {
      return res.status(400).json({ message: "Member list is required." });
    }

    const normalizedIds = normalizeMemberIds(memberIds, req.user._id);
    const users = await User.find({ _id: { $in: normalizedIds } }).select("_id");
    if (users.length !== normalizedIds.length) {
      return res.status(404).json({ message: "One or more members could not be found." });
    }

    const existingBalances = new Map(
      group.members.map((member) => [member.user.toString(), Number(member.balance || 0)])
    );
    group.members = normalizedIds.map((id) => ({
      user: id,
      balance: existingBalances.get(id.toString()) || 0
    }));
    await group.save();

    const updatedGroup = await recalculateGroupBalances(group._id);
    req.app.get("io").to(group._id.toString()).emit("group:updated", { groupId: group._id.toString() });

    return res.json(serializeGroup(updatedGroup));
  } catch (error) {
    return res.status(500).json({ message: "Could not update group members.", error: error.message });
  }
}

async function deleteGroup(req, res) {
  try {
    const group = await Group.findOne({
      _id: req.params.groupId,
      "members.user": req.user._id
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    await Promise.all([
      Expense.deleteMany({ group: group._id }),
      Settlement.deleteMany({ group: group._id }),
      Group.deleteOne({ _id: group._id })
    ]);

    req.app.get("io").to(group._id.toString()).emit("group:updated", { groupId: group._id.toString() });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: "Could not delete group.", error: error.message });
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

    const settlementAmount = Number(amount);
    if (!Number.isFinite(settlementAmount) || settlementAmount <= 0) {
      return res.status(400).json({ message: "Settlement amount must be greater than 0." });
    }

    if (fromUser === toUser) {
      return res.status(400).json({ message: "Settlement users must be different." });
    }

    if (!isGroupMember(group, fromUser) || !isGroupMember(group, toUser)) {
      return res.status(400).json({ message: "Settlement users must be members of this group." });
    }

    const settlement = await Settlement.create({
      group: group._id,
      fromUser,
      toUser,
      amount: Number(settlementAmount.toFixed(2)),
      note: note || ""
    });

    const updatedGroup = await recalculateGroupBalances(group._id);
    req.app.get("io").to(group._id.toString()).emit("group:updated", { groupId: group._id.toString() });

    res.status(201).json({ settlement, group: serializeGroup(updatedGroup) });
  } catch (error) {
    res.status(500).json({ message: "Could not record settlement.", error: error.message });
  }
}

module.exports = {
  listGroups,
  createGroup,
  getGroupDetails,
  createExpense,
  updateExpense,
  addGroupMember,
  updateGroupMembers,
  deleteGroup,
  createSettlement
};
