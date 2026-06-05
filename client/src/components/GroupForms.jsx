import { useEffect, useMemo, useState } from "react";
import { buildExactSplitsWithProportionalTax, splitEqually } from "../utils/splitCalculations";

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function FriendAvatar({ friend }) {
  return (
    <span className={`friend-avatar compact-avatar ${friend?.profilePhoto ? "has-photo" : ""}`} aria-hidden="true">
      {friend?.profilePhoto ? <img src={friend.profilePhoto} alt="" /> : initials(friend?.name)}
    </span>
  );
}

export function CreateGroupForm({ currentUser, friends = [], onCreate, onCreated, submitLabel = "Create group" }) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    friendIds: []
  });
  const [friendSearch, setFriendSearch] = useState("");
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleFriend(friendId) {
    setForm((current) => {
      const friendIds = current.friendIds.includes(friendId)
        ? current.friendIds.filter((id) => id !== friendId)
        : [...current.friendIds, friendId];
      return { ...current, friendIds };
    });
  }

  const selectedFriendNames = useMemo(() => {
    const names = friends.filter((friend) => form.friendIds.includes(friend.id)).map((friend) => friend.name);
    return names.length ? names.join(", ") : "No friends selected";
  }, [friends, form.friendIds]);
  const selectedFriends = useMemo(
    () => friends.filter((friend) => form.friendIds.includes(friend.id)),
    [friends, form.friendIds]
  );
  const filteredFriends = useMemo(() => {
    const query = friendSearch.trim().toLowerCase();
    if (!query) return friends;
    return friends.filter((friend) => `${friend.name} ${friend.username}`.toLowerCase().includes(query));
  }, [friends, friendSearch]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Enter a group name.");
      return;
    }
    if (!currentUser?.id) {
      setError("Sign in again before creating a group.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const createdGroup = await onCreate({
        name: form.name.trim(),
        description: form.description.trim(),
        currency: "USD",
        memberIds: form.friendIds
      });
      onCreated?.(createdGroup);

      setForm({
        name: "",
        description: "",
        friendIds: []
      });
      setFriendSearch("");
      setFriendsOpen(false);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel compact-form simple-group-form" onSubmit={handleSubmit}>
      <h3>Create a group</h3>
      {error ? <p className="form-error">{error}</p> : null}

      <div className="mobile-form-card group-details-card">
        <div className="mobile-card-heading">
          <span className="mobile-card-icon receipt" aria-hidden="true" />
          <div>
            <strong>Group details</strong>
            <p>Name the shared space.</p>
          </div>
        </div>

        <label className="form-field">
          <span>Group name <em>*</em></span>
          <input
            placeholder="Enter group name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>

        <label className="form-field">
          <span>Description <small>Optional</small></span>
          <textarea
            placeholder="Enter a short description"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </label>
      </div>

      <div className="friend-picker create-friends-panel">
        <div className="mobile-card-heading">
          <span className="mobile-card-icon friends" aria-hidden="true" />
          <div>
            <strong>Add friends</strong>
            <p>Search and select friends to add.</p>
          </div>
        </div>
        <div className="create-friends-heading">
          <strong>Add friends</strong>
          <span>Search and select friends to add to this group.</span>
        </div>

        <input
          className="friend-search-input"
          placeholder="Search friends by name"
          value={friendSearch}
          onChange={(event) => setFriendSearch(event.target.value)}
        />

        <div className="selected-friends-summary">
          <button
            type="button"
            className="selected-friends-toggle"
            onClick={() => setFriendsOpen((current) => !current)}
            aria-expanded={friendsOpen}
          >
            <span>Selected friends ({selectedFriends.length})</span>
            <em>{friendsOpen ? "Hide all" : "Show all"}</em>
          </button>
          <div className="selected-friends-chips">
            {selectedFriends.map((friend) => (
              <span key={friend.id}>
                <FriendAvatar friend={friend} />
                {friend.name}
              </span>
            ))}
            {!selectedFriends.length ? <p>{selectedFriendNames}</p> : null}
          </div>
        </div>

        {friendsOpen ? (
          <div className="friend-picker-list">
            {filteredFriends.map((friend) => (
              <label className="friend-picker-option" key={friend.id}>
                <input
                  type="checkbox"
                  checked={form.friendIds.includes(friend.id)}
                  onChange={() => toggleFriend(friend.id)}
                />
                <FriendAvatar friend={friend} />
                <span>
                  {friend.name}
                  <em>@{friend.username}</em>
                </span>
              </label>
            ))}
            {!friends.length ? <p className="empty-copy">Add friends first, then they will appear here.</p> : null}
            {friends.length && !filteredFriends.length ? <p className="empty-copy">No friends match that search.</p> : null}
          </div>
        ) : null}
      </div>

      <button type="submit" disabled={saving}>
        {saving ? "Creating..." : submitLabel}
      </button>
    </form>
  );
}

export function AddExpenseForm({ groups, selectedGroupId, currentUser, onSelectGroup, onAddExpense }) {
  const selectedGroup = groups.find((group) => group._id === selectedGroupId);
  const members = selectedGroup?.members || [];
  const [form, setForm] = useState({
    menuAmount: "",
    taxAmount: "",
    tipAmount: "",
    paidBy: currentUser?.id || "",
    participantIds: [],
    splitType: "equal",
    exactShares: {}
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedGroup) return;
    const memberIds = members.map((member) => member.user._id);
    setForm((current) => ({
      ...current,
      paidBy: memberIds.includes(current.paidBy)
        ? current.paidBy
        : memberIds.includes(currentUser?.id)
          ? currentUser.id
          : members[0]?.user._id || "",
      participantIds: memberIds,
      exactShares: {}
    }));
  }, [selectedGroupId]);

  function toggleParticipant(memberId) {
    setForm((current) => {
      const participantIds = current.participantIds.includes(memberId)
        ? current.participantIds.filter((id) => id !== memberId)
        : [...current.participantIds, memberId];
      return { ...current, participantIds };
    });
  }

  function buildSplits(totalAmount, menuAmount, taxAmount, tipAmount) {
    if (!form.participantIds.length) {
      throw new Error("Select at least one participant.");
    }

    if (form.splitType === "equal") {
      return splitEqually(totalAmount, form.participantIds);
    }

    return buildExactSplitsWithProportionalTax({
      subtotalAmount: menuAmount,
      taxAmount,
      tipAmount,
      memberIds: form.participantIds,
      exactShares: form.exactShares
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const menuAmount = Number(form.menuAmount || 0);
    const taxAmount = Number(form.taxAmount || 0);
    const tipAmount = Number(form.tipAmount || 0);
    const totalAmount = Number((menuAmount + taxAmount + tipAmount).toFixed(2));

    if (!selectedGroup) {
      setError("Select a group first.");
      return;
    }
    if (!Number.isFinite(menuAmount) || !Number.isFinite(taxAmount) || !Number.isFinite(tipAmount)) {
      setError("Enter valid amounts.");
      return;
    }
    if (menuAmount <= 0 || taxAmount < 0 || tipAmount < 0) {
      setError("Subtotal must be greater than 0. Tax and tip cannot be negative.");
      return;
    }
    if (!form.paidBy) {
      setError("Choose who paid.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const splits = buildSplits(totalAmount, menuAmount, taxAmount, tipAmount);
      await onAddExpense(selectedGroup._id, {
        description: `${selectedGroup.name} expense`,
        amount: Number(totalAmount.toFixed(2)),
        menuAmount: Number(menuAmount.toFixed(2)),
        taxAmount: Number(taxAmount.toFixed(2)),
        tipAmount: Number(tipAmount.toFixed(2)),
        paidBy: form.paidBy,
        category: "General",
        splitType: form.splitType,
        splits
      });
      setForm({
        menuAmount: "",
        taxAmount: "",
        tipAmount: "",
        paidBy: currentUser?.id || "",
        participantIds: members.map((member) => member.user._id),
        splitType: "equal",
        exactShares: {}
      });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel compact-form expense-panel" onSubmit={handleSubmit}>
      <h3>Add expense</h3>
      {error ? <p className="form-error">{error}</p> : null}

      <div className="mobile-form-card expense-details-card">
        <div className="mobile-card-heading">
          <span className="mobile-card-icon receipt" aria-hidden="true" />
          <div>
            <strong>Expense details</strong>
            <p>Add the bill amount and payer.</p>
          </div>
        </div>

        <select value={selectedGroupId} onChange={(event) => onSelectGroup(event.target.value)}>
          <option value="">Select group</option>
          {groups.map((group) => (
            <option key={group._id} value={group._id}>
              {group.name}
            </option>
          ))}
        </select>

        <label className="form-field mobile-expense-title-field">
          <span>Expense title</span>
          <input value={selectedGroup ? `${selectedGroup.name} expense` : ""} placeholder="Select a group first" readOnly />
        </label>

        <div className="money-row">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Subtotal"
            value={form.menuAmount}
            onChange={(event) => setForm({ ...form, menuAmount: event.target.value })}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Tax"
            value={form.taxAmount}
            onChange={(event) => setForm({ ...form, taxAmount: event.target.value })}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Tip"
            value={form.tipAmount}
            onChange={(event) => setForm({ ...form, tipAmount: event.target.value })}
          />
        </div>
        <p className="form-helper">Total: {money(Number(form.menuAmount || 0) + Number(form.taxAmount || 0) + Number(form.tipAmount || 0))}</p>

        <select value={form.paidBy} onChange={(event) => setForm({ ...form, paidBy: event.target.value })}>
          <option value="">Who paid?</option>
          {members.map((member) => (
            <option key={member.user._id} value={member.user._id}>
              {member.user.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mobile-form-card expense-split-card">
        <div className="mobile-card-heading">
          <span className="mobile-card-icon friends" aria-hidden="true" />
          <div>
            <strong>Participants</strong>
            <p>Choose who was involved.</p>
          </div>
        </div>
        <div className="participant-list">
          <span>Participants</span>
          {members.map((member) => (
            <label className="participant-option" key={member.user._id}>
              <input
                type="checkbox"
                checked={form.participantIds.includes(member.user._id)}
                onChange={() => toggleParticipant(member.user._id)}
              />
              <span>{member.user.name}</span>
            </label>
          ))}
          {!members.length ? <p className="empty-copy">Create or select a group first.</p> : null}
        </div>

        <div className="split-type-control">
          <button
            type="button"
            className={form.splitType === "equal" ? "active" : ""}
            onClick={() => setForm({ ...form, splitType: "equal" })}
          >
            Split equally
          </button>
          <button
            type="button"
            className={form.splitType === "exact" ? "active" : ""}
            onClick={() => setForm({ ...form, splitType: "exact" })}
          >
            Split by exact amount
          </button>
        </div>

        {form.splitType === "exact" ? (
          <div className="participant-list">
            <span>Exact item subtotal before tax/tip</span>
            {members
              .filter((member) => form.participantIds.includes(member.user._id))
              .map((member) => (
                <label className="participant-option" key={member.user._id}>
                  <span>{member.user.name}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.exactShares[member.user._id] || ""}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        exactShares: { ...form.exactShares, [member.user._id]: event.target.value }
                      })
                    }
                  />
                </label>
              ))}
            <p className="empty-copy">Tax is split by item subtotal. Tip is split equally.</p>
          </div>
        ) : (
          <p className="empty-copy">
            {form.participantIds.length
              ? `${money(
                  (Number(form.menuAmount || 0) + Number(form.taxAmount || 0) + Number(form.tipAmount || 0)) /
                    form.participantIds.length
                )} each across ${form.participantIds.length} participants.`
              : ""}
          </p>
        )}
      </div>

      <button type="submit" disabled={saving}>
        {saving ? "Saving..." : "Save expense"}
      </button>
    </form>
  );
}

export function SettlementForm({ groups, selectedGroupId, onSelectGroup, onAddSettlement }) {
  const selectedGroup = groups.find((group) => group._id === selectedGroupId);
  const members = selectedGroup?.members || [];
  const [form, setForm] = useState({ fromUser: "", toUser: "", amount: "" });
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    const amount = Number(form.amount || 0);

    if (!selectedGroup) {
      setError("Pick a group.");
      return;
    }
    if (!form.fromUser || !form.toUser || amount <= 0) {
      setError("Pick who paid, who received it, and the amount.");
      return;
    }
    if (form.fromUser === form.toUser) {
      setError("Choose two different people.");
      return;
    }

    try {
      setError("");
      await onAddSettlement({
        fromUser: form.fromUser,
        toUser: form.toUser,
        amount,
        note: "Recorded settlement"
      });
      setForm({ fromUser: "", toUser: "", amount: "" });
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <form className="panel compact-form settlement-panel" onSubmit={handleSubmit}>
      <h3>Record settlement</h3>
      {error ? <p className="form-error">{error}</p> : null}

      <select value={selectedGroupId} onChange={(event) => onSelectGroup(event.target.value)}>
        <option value="">Pick group</option>
        {groups.map((group) => (
          <option key={group._id} value={group._id}>
            {group.name}
          </option>
        ))}
      </select>

      <select value={form.fromUser} onChange={(event) => setForm({ ...form, fromUser: event.target.value })}>
        <option value="">Who paid</option>
        {members.map((member) => (
          <option key={member.user._id} value={member.user._id}>
            {member.user.name}
          </option>
        ))}
      </select>

      <select value={form.toUser} onChange={(event) => setForm({ ...form, toUser: event.target.value })}>
        <option value="">Who received it</option>
        {members.map((member) => (
          <option key={member.user._id} value={member.user._id}>
            {member.user.name}
          </option>
        ))}
      </select>

      <input
        type="number"
        min="0"
        step="0.01"
        placeholder="Amount paid"
        value={form.amount}
        onChange={(event) => setForm({ ...form, amount: event.target.value })}
      />

      <button type="submit">Save settlement</button>
    </form>
  );
}
