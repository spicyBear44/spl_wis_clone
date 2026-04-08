import { useMemo, useState } from "react";

export function CreateGroupForm({ onCreate }) {
  const [form, setForm] = useState({ name: "", description: "", currency: "USD" });

  async function handleSubmit(event) {
    event.preventDefault();
    await onCreate({ ...form, memberIds: [] });
    setForm({ name: "", description: "", currency: "USD" });
  }

  return (
    <form className="panel compact-form" onSubmit={handleSubmit}>
      <h3>Create a group</h3>
      <input
        placeholder="Trip to Vegas"
        value={form.name}
        onChange={(event) => setForm({ ...form, name: event.target.value })}
      />
      <input
        placeholder="Weekend flight, food, hotel"
        value={form.description}
        onChange={(event) => setForm({ ...form, description: event.target.value })}
      />
      <input
        placeholder="Currency"
        value={form.currency}
        onChange={(event) => setForm({ ...form, currency: event.target.value })}
      />
      <button type="submit">Create group</button>
    </form>
  );
}

export function AddExpenseForm({ group, currentUser, onAddExpense, onAddSettlement, friends, onAddMember }) {
  const groupMembers = group?.members || [];
  const memberOptions = useMemo(
    () => groupMembers.map((member) => ({ id: member.user._id, label: member.user.name })),
    [groupMembers]
  );
  const addableFriends = useMemo(
    () => (friends || []).filter((friend) => !groupMembers.some((member) => member.user._id === friend.id)),
    [friends, groupMembers]
  );
  const [friendToAdd, setFriendToAdd] = useState("");
  const [expense, setExpense] = useState({
    description: "",
    amount: "",
    paidBy: currentUser?.id || "",
    category: "General"
  });
  const [settlement, setSettlement] = useState({
    fromUser: "",
    toUser: "",
    amount: "",
    note: ""
  });

  if (!group) return null;

  async function submitExpense(event) {
    event.preventDefault();
    const amount = Number(expense.amount || 0);
    const equalShare = Number((amount / memberOptions.length).toFixed(2));
    const splits = memberOptions.map((member, index) => {
      if (index === memberOptions.length - 1) {
        const assigned = Number((equalShare * (memberOptions.length - 1)).toFixed(2));
        return { user: member.id, amount: Number((amount - assigned).toFixed(2)) };
      }
      return { user: member.id, amount: equalShare };
    });

    await onAddExpense({
      ...expense,
      amount,
      paidBy: expense.paidBy || currentUser.id,
      splits
    });
    setExpense({ description: "", amount: "", paidBy: currentUser?.id || "", category: "General" });
  }

  async function submitSettlement(event) {
    event.preventDefault();
    await onAddSettlement({ ...settlement, amount: Number(settlement.amount) });
    setSettlement({ fromUser: "", toUser: "", amount: "", note: "" });
  }

  async function handleAddUser(user) {
    await onAddMember({ userId: user.id });
    setFriendToAdd("");
  }

  return (
    <div className="form-grid">
      <section className="panel compact-form">
        <h3>Add friend to group</h3>
        {!addableFriends.length ? <p className="empty-copy">Add friends first to invite them here.</p> : null}
        {addableFriends.length ? (
          <>
            <select value={friendToAdd} onChange={(event) => setFriendToAdd(event.target.value)}>
              <option value="">Select a friend</option>
              {addableFriends.map((friend) => (
                <option key={friend.id} value={friend.id}>
                  {friend.name} (@{friend.username})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!friendToAdd}
              onClick={() => handleAddUser(addableFriends.find((friend) => friend.id === friendToAdd))}
            >
              Add to group
            </button>
          </>
        ) : null}
      </section>

      <form className="panel compact-form" onSubmit={submitExpense}>
        <h3>Add expense</h3>
        <input
          placeholder="Dinner"
          value={expense.description}
          onChange={(event) => setExpense({ ...expense, description: event.target.value })}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Amount"
          value={expense.amount}
          onChange={(event) => setExpense({ ...expense, amount: event.target.value })}
        />
        <select value={expense.paidBy} onChange={(event) => setExpense({ ...expense, paidBy: event.target.value })}>
          {memberOptions.map((member) => (
            <option key={member.id} value={member.id}>
              {member.label}
            </option>
          ))}
        </select>
        <input
          placeholder="Category"
          value={expense.category}
          onChange={(event) => setExpense({ ...expense, category: event.target.value })}
        />
        <button type="submit">Save expense</button>
      </form>

      <form className="panel compact-form" onSubmit={submitSettlement}>
        <h3>Record settlement</h3>
        <select
          value={settlement.fromUser}
          onChange={(event) => setSettlement({ ...settlement, fromUser: event.target.value })}
        >
          <option value="">From user</option>
          {memberOptions.map((member) => (
            <option key={member.id} value={member.id}>
              {member.label}
            </option>
          ))}
        </select>
        <select
          value={settlement.toUser}
          onChange={(event) => setSettlement({ ...settlement, toUser: event.target.value })}
        >
          <option value="">To user</option>
          {memberOptions.map((member) => (
            <option key={member.id} value={member.id}>
              {member.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Amount"
          value={settlement.amount}
          onChange={(event) => setSettlement({ ...settlement, amount: event.target.value })}
        />
        <input
          placeholder="Note"
          value={settlement.note}
          onChange={(event) => setSettlement({ ...settlement, note: event.target.value })}
        />
        <button type="submit">Save settlement</button>
      </form>
    </div>
  );
}
