function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function GroupDetails({ details, currentUser }) {
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

  function balanceLabel(suggestion) {
    if (suggestion.from._id === currentUser?.id) {
      return `You owe ${suggestion.to.name}`;
    }
    return `${suggestion.from.name} owes ${displayName(suggestion.to)}`;
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

      <div className="breakdown-section">
        <div className="breakdown-heading">
          <h4>What everyone spent</h4>
          <p>Each person's share from the saved bill splits.</p>
        </div>
        <div className="spend-grid">
          {group.members.map((member) => {
            const spentAmount = spentTotals.get(member.user._id) || 0;
            return (
              <article className="spend-card" key={member.user._id}>
                <div>
                  <strong>{displayName(member.user)}</strong>
                  <span>@{member.user.username}</span>
                </div>
                <div>
                  <span>Spent</span>
                  <em>{money(spentAmount)}</em>
                </div>
                <div>
                  <span>Balance</span>
                  <em className={member.balance >= 0 ? "positive" : "negative"}>{money(member.balance)}</em>
                </div>
              </article>
            );
          })}
        </div>
      </div>

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

      <div className="breakdown-section two-column-breakdown">
        <div>
          <div className="breakdown-heading">
            <h4>What needs settling</h4>
            <p>Simple payments to square the group.</p>
          </div>
          <div className="stack-list">
            {suggestions.map((suggestion, index) => (
              <div className="activity-row balance-row" key={`${suggestion.from._id}-${suggestion.to._id}-${index}`}>
                <div>
                  <strong>{balanceLabel(suggestion)}</strong>
                  <p>{money(suggestion.amount)} remaining</p>
                </div>
                <span className="status-pill unsettled">Unsettled</span>
              </div>
            ))}
            {!suggestions.length ? <p className="empty-copy">Everyone is square right now.</p> : null}
          </div>
        </div>

        <div>
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
      </div>
    </section>
  );
}
