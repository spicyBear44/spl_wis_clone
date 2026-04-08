export default function SummaryCards({ summary }) {
  const cards = [
    { label: "Groups", value: summary.totalGroups },
    { label: "You are owed", value: `$${summary.youAreOwed.toFixed(2)}` },
    { label: "You owe", value: `$${summary.youOwe.toFixed(2)}` },
    { label: "Net", value: `$${summary.netBalance.toFixed(2)}` }
  ];

  return (
    <section className="summary-grid">
      {cards.map((card) => (
        <article className="summary-card" key={card.label}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </article>
      ))}
    </section>
  );
}
