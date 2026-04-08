const Group = require("../models/Group");
const Expense = require("../models/Expense");
const Settlement = require("../models/Settlement");

async function recalculateGroupBalances(groupId) {
  const group = await Group.findById(groupId);
  if (!group) {
    throw new Error("Group not found.");
  }

  const expenses = await Expense.find({ group: groupId });
  const settlements = await Settlement.find({ group: groupId });

  const balances = new Map();
  group.members.forEach((member) => {
    balances.set(member.user.toString(), 0);
  });

  expenses.forEach((expense) => {
    const payerId = expense.paidBy.toString();
    balances.set(payerId, (balances.get(payerId) || 0) + expense.amount);

    expense.splits.forEach((split) => {
      const splitUserId = split.user.toString();
      balances.set(splitUserId, (balances.get(splitUserId) || 0) - split.amount);
    });
  });

  settlements.forEach((settlement) => {
    const fromId = settlement.fromUser.toString();
    const toId = settlement.toUser.toString();
    balances.set(fromId, (balances.get(fromId) || 0) + settlement.amount);
    balances.set(toId, (balances.get(toId) || 0) - settlement.amount);
  });

  group.members = group.members.map((member) => ({
    user: member.user,
    nickname: member.nickname,
    balance: Number((balances.get(member.user.toString()) || 0).toFixed(2))
  }));

  await group.save();
  return group.populate("members.user", "name username");
}

function buildSettlementSuggestions(group) {
  const creditors = [];
  const debtors = [];

  group.members.forEach((member) => {
    if (member.balance > 0.009) {
      creditors.push({
        user: member.user,
        amount: Number(member.balance.toFixed(2))
      });
    } else if (member.balance < -0.009) {
      debtors.push({
        user: member.user,
        amount: Number(Math.abs(member.balance).toFixed(2))
      });
    }
  });

  const suggestions = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = Number(Math.min(creditor.amount, debtor.amount).toFixed(2));

    suggestions.push({
      from: debtor.user,
      to: creditor.user,
      amount
    });

    creditor.amount = Number((creditor.amount - amount).toFixed(2));
    debtor.amount = Number((debtor.amount - amount).toFixed(2));

    if (creditor.amount <= 0.009) creditorIndex += 1;
    if (debtor.amount <= 0.009) debtorIndex += 1;
  }

  return suggestions;
}

module.exports = { recalculateGroupBalances, buildSettlementSuggestions };
