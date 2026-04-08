const Group = require("../models/Group");
const Expense = require("../models/Expense");
const Settlement = require("../models/Settlement");

async function getDashboard(req, res) {
  try {
    const groups = await Group.find({ "members.user": req.user._id }).populate(
      "members.user",
      "name username"
    );
    const groupIds = groups.map((group) => group._id);

    const recentExpenses = await Expense.find({ group: { $in: groupIds } })
      .populate("paidBy", "name username")
      .sort({ expenseDate: -1, createdAt: -1 })
      .limit(8);
    const recentSettlements = await Settlement.find({ group: { $in: groupIds } })
      .populate("fromUser", "name username")
      .populate("toUser", "name username")
      .sort({ settledAt: -1, createdAt: -1 })
      .limit(8);

    const totals = groups.reduce(
      (accumulator, group) => {
        const currentMember = group.members.find(
          (member) => member.user._id.toString() === req.user._id.toString()
        );
        const balance = currentMember ? currentMember.balance : 0;

        accumulator.netBalance += balance;
        if (balance > 0) accumulator.youAreOwed += balance;
        if (balance < 0) accumulator.youOwe += Math.abs(balance);
        return accumulator;
      },
      { totalGroups: groups.length, netBalance: 0, youAreOwed: 0, youOwe: 0 }
    );

    res.json({
      summary: {
        totalGroups: totals.totalGroups,
        netBalance: Number(totals.netBalance.toFixed(2)),
        youAreOwed: Number(totals.youAreOwed.toFixed(2)),
        youOwe: Number(totals.youOwe.toFixed(2))
      },
      groups,
      recentExpenses,
      recentSettlements
    });
  } catch (error) {
    res.status(500).json({ message: "Could not load dashboard.", error: error.message });
  }
}

module.exports = { getDashboard };
