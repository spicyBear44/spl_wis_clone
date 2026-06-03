export default function SummaryCards({ summary }) {
  const cards = [
    {
      label: "Total Groups",
      value: summary.totalGroups,
      type: "neutral"
    },
    {
      label: "Net",
      value: `${summary.netBalance >= 0 ? "+" : "-"}$${Math.abs(summary.netBalance).toFixed(2)}`,
      type: summary.netBalance >= 0 ? "positive" : "negative"
    },
    {
      label: "You are owed",
      value: `+$${summary.youAreOwed.toFixed(2)}`,
      type: "positive"
    },
    {
      label: "You owe",
      value: `-$${summary.youOwe.toFixed(2)}`,
      type: "negative"
    }
  ];

  return (
    <section className="summary-grid">
      {cards.map((card) => (
        <article className="summary-card" key={card.label}>
          <span>{card.label}</span>
          <strong className={`summary-value ${card.type}`}>
            {card.value}
          </strong>
        </article>
      ))}
    </section>
  );
}
