function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function GroupDetails({ details }) {
  if (!details) {
    return (
      <section className="panel">
        <h3>Select a group</h3>
        <p className="empty-copy">Choose a group on the left to view balances and activity.</p>
      </section>
    );
  }

  const { group, expenses, settlements, suggestions } = details;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h3>{group.name}</h3>
          <p>{group.description || "Shared expenses"}</p>
        </div>
        <span className="badge">{group.currency}</span>
      </div>

      <div className="member-grid">
        {group.members.map((member) => (
          <article className="member-card" key={member.user._id}>
            <strong>{member.user.name}</strong>
            <span>@{member.user.username}</span>
            <em className={member.balance >= 0 ? "positive" : "negative"}>{money(member.balance)}</em>
          </article>
        ))}
      </div>

      <div className="detail-columns">
        <div>
          <h4>Recent expenses</h4>
          <div className="stack-list">
            {expenses.slice(0, 6).map((expense) => (
              <div className="activity-row" key={expense._id}>
                <div>
                  <strong>{expense.description}</strong>
                  <p>
                    Paid by {expense.paidBy.name} • {new Date(expense.expenseDate).toLocaleDateString()}
                  </p>
                </div>
                <span>{money(expense.amount)}</span>
              </div>
            ))}
            {!expenses.length ? <p className="empty-copy">No expenses in this group yet.</p> : null}
          </div>
        </div>

        <div>
          <h4>Settlement suggestions</h4>
          <div className="stack-list">
            {suggestions.map((suggestion, index) => (
              <div className="activity-row" key={`${suggestion.from}-${suggestion.to}-${index}`}>
                <div>
                  <strong>{suggestion.from.name}</strong>
                  <p>should pay {suggestion.to.name}</p>
                </div>
                <span>{money(suggestion.amount)}</span>
              </div>
            ))}
            {!suggestions.length ? <p className="empty-copy">Everyone is square right now.</p> : null}
          </div>
        </div>
      </div>

      <div className="detail-columns">
        <div>
          <h4>Recent settlements</h4>
          <div className="stack-list">
            {settlements.slice(0, 6).map((settlement) => (
              <div className="activity-row" key={settlement._id}>
                <div>
                  <strong>{settlement.fromUser.name}</strong>
                  <p>paid {settlement.toUser.name}</p>
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
