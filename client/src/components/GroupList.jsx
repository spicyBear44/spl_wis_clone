export default function GroupList({ groups, selectedGroupId, onSelect }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Your groups</h3>
      </div>
      <div className="stack-list">
        {groups.map((group) => (
          <button
            key={group._id}
            className={`group-tile ${selectedGroupId === group._id ? "active" : ""}`}
            onClick={() => onSelect(group._id)}
          >
            <div>
              <strong>{group.name}</strong>
              <p>{group.description || "Shared expenses and balances"}</p>
            </div>
            <span>{group.members.length} members</span>
          </button>
        ))}
        {!groups.length ? <p className="empty-copy">No groups yet. Create one to get started.</p> : null}
      </div>
    </section>
  );
}
