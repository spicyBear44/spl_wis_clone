import { useState } from "react";

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function buildSettlementRowsFromBalances(members = []) {
  const creditors = [];
  const debtors = [];

  members.forEach((member) => {
    const balance = Number(member.balance || 0);
    if (balance > 0.009) {
      creditors.push({ user: member.user, amount: Number(balance.toFixed(2)) });
    } else if (balance < -0.009) {
      debtors.push({ user: member.user, amount: Number(Math.abs(balance).toFixed(2)) });
    }
  });

  const rows = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = Number(Math.min(creditor.amount, debtor.amount).toFixed(2));

    rows.push({ from: debtor.user, to: creditor.user, amount });

    creditor.amount = Number((creditor.amount - amount).toFixed(2));
    debtor.amount = Number((debtor.amount - amount).toFixed(2));

    if (creditor.amount <= 0.009) creditorIndex += 1;
    if (debtor.amount <= 0.009) debtorIndex += 1;
  }

  return rows;
}

export default function GroupDetails({ details, currentUser }) {
  const [fullSplitOpen, setFullSplitOpen] = useState(false);

  if (!details) {
    return (
      <section className="panel">
        <h3>Select a group</h3>
        <p className="empty-copy">Choose a group on the left to view who paid and how the bill was split.</p>
      </section>
    );
  }

  const { group, expenses, settlements, suggestions } = details;
  const isSettled = !suggestions.length;
  const totalBill = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const paidTotals = new Map();
  const spentTotals = new Map();
  const paymentSummaryRows = suggestions.length ? suggestions : buildSettlementRowsFromBalances(group.members);

  expenses.forEach((expense) => {
    const payerId = expense.paidBy?._id;
    if (payerId) {
      paidTotals.set(payerId, (paidTotals.get(payerId) || 0) + Number(expense.amount || 0));
    }

    expense.splits?.forEach((split) => {
      const userId = split.user?._id || split.user;
      if (userId) {
        spentTotals.set(userId, (spentTotals.get(userId) || 0) + Number(split.amount || 0));
      }
    });
  });

  function displayName(person) {
    if (!person) return "Someone";
    return person._id === currentUser?.id ? "you" : person.name;
  }

  function paymentSummaryLabel(row) {
    if (row.from?._id === currentUser?.id) {
      return `You owe ${row.to?.name || "someone"} ${money(row.amount)}`;
    }
    return `${row.from?.name || "Someone"} owes ${displayName(row.to)} ${money(row.amount)}`;
  }

  return (
    <section className="panel group-breakdown-panel">
      <div className="panel-header">
        <div>
          <h3>{group.name}</h3>
          <p>{group.description || "Shared expenses"}</p>
        </div>
        <div className="status-stack">
          <span className={`status-pill ${isSettled ? "settled" : "unsettled"}`}>
            {isSettled ? "Settled" : "Unsettled"}
          </span>
          <span className="badge">{group.currency}</span>
        </div>
      </div>

      <div className="bill-summary-grid">
        <article className="bill-summary-card">
          <span>Total bill</span>
          <strong>{money(totalBill)}</strong>
        </article>
        <article className="bill-summary-card">
          <span>People involved</span>
          <strong>{group.members.length}</strong>
        </article>
        <article className="bill-summary-card">
          <span>Status</span>
          <strong>{isSettled ? "Settled" : "Unsettled"}</strong>
        </article>
      </div>

      <div className="breakdown-section payment-summary-section">
        <div className="breakdown-heading">
          <h4>Payment summary</h4>
          <p>What each person should pay to settle the group.</p>
        </div>
        <div className="payment-summary-list">
          {paymentSummaryRows.map((row, index) => (
            <article className="payment-summary-row" key={`${row.from?._id}-${row.to?._id}-${index}`}>
              <div>
                <strong>
                  {paymentSummaryLabel(row)}
                </strong>
                <p>{money(row.amount)} remaining</p>
              </div>
              <span className="status-pill unsettled">Pay</span>
            </article>
          ))}
          {!paymentSummaryRows.length ? <p className="empty-copy">Everyone is square right now.</p> : null}
        </div>
      </div>

      <div className="breakdown-section">
        <div className="breakdown-heading">
          <h4>Who paid</h4>
          <p>Total amount each person covered for the group.</p>
        </div>
        <div className="payer-list">
          {group.members.map((member) => {
            const paidAmount = paidTotals.get(member.user._id) || 0;
            return (
              <article className="payer-row" key={member.user._id}>
                <div>
                  <strong>{displayName(member.user)}</strong>
                  <span>@{member.user.username}</span>
                </div>
                <em>{money(paidAmount)}</em>
              </article>
            );
          })}
        </div>
      </div>

      <details
        className="breakdown-section full-split-details"
        open={fullSplitOpen}
        onToggle={(event) => setFullSplitOpen(event.currentTarget.open)}
      >
        <summary>
          <span>Full split details</span>
          <em>{fullSplitOpen ? "Hide shares" : "Show shares"}</em>
        </summary>
        <div className="spend-grid">
          {group.members.map((member) => {
            const spentAmount = spentTotals.get(member.user._id) || 0;
            return (
              <article className="spend-card" key={member.user._id}>
                <div>
                  <strong>{displayName(member.user)}'s share</strong>
                  <span>@{member.user.username}</span>
                </div>
                <div>
                  <span>Actual share</span>
                  <em>{money(spentAmount)}</em>
                </div>
                <div>
                  <span>Net balance</span>
                  <em className={member.balance >= 0 ? "positive" : "negative"}>{money(member.balance)}</em>
                </div>
              </article>
            );
          })}
        </div>
      </details>

      <div className="breakdown-section">
        <div className="breakdown-heading">
          <h4>Bills</h4>
          <p>Saved expenses in this group.</p>
        </div>
        <div className="bill-list">
          {expenses.map((expense) => (
            <article className="bill-row" key={expense._id}>
              <div>
                <strong>{expense.description}</strong>
                <p>
                  Paid by {displayName(expense.paidBy)} •{" "}
                  {expense.splitType === "exact" ? "Split by exact amount" : "Split equally"} •{" "}
                  {new Date(expense.expenseDate).toLocaleDateString()}
                </p>
              </div>
              <strong>{money(expense.amount)}</strong>
            </article>
          ))}
          {!expenses.length ? <p className="empty-copy">No expenses in this group yet.</p> : null}
        </div>
      </div>

      <div className="breakdown-section">
        <div className="breakdown-heading">
          <h4>Settlements</h4>
          <p>Payments already recorded.</p>
        </div>
        <div className="stack-list">
          {settlements.slice(0, 6).map((settlement) => (
            <div className="activity-row" key={settlement._id}>
              <div>
                <strong>{displayName(settlement.fromUser)} paid {displayName(settlement.toUser)}</strong>
                <p>{settlement.note || "Marked as settled"}</p>
              </div>
              <span>{money(settlement.amount)}</span>
            </div>
          ))}
          {!settlements.length ? <p className="empty-copy">No settlements recorded yet.</p> : null}
        </div>
      </div>
    </section>
  );
}
