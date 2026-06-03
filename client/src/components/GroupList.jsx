import { useEffect, useMemo, useState } from "react";

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function groupUnsettledTotal(group) {
  const total = group.members.reduce((sum, member) => sum + Math.abs(Number(member.balance || 0)), 0);
  return Number((total / 2).toFixed(2));
}

function splitEqually(totalAmount, memberIds) {
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / memberIds.length);
  const remainder = totalCents - baseCents * memberIds.length;

  return memberIds.map((memberId, index) => ({
    user: memberId,
    amount: Number(((baseCents + (index < remainder ? 1 : 0)) / 100).toFixed(2))
  }));
}

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function splitTypeLabel(splitType) {
  return splitType === "exact" ? "Split by exact amount" : "Split equally";
}

function buildGroupPreview(group) {
  const members = group?.members || [];

  return {
    group,
    totalSpent: 0,
    splitTypes: [],
    payerTotals: [],
    memberShares: members.map((member) => ({
      id: member.user._id,
      name: member.user.name,
      username: member.user.username,
      amount: Number(member.balance || 0)
    })),
    expenses: []
  };
}

export default function GroupList({
  groups,
  selectedGroupId,
  selectedGroupDetails,
  friends = [],
  currentUser,
  onSelect,
  onUpdateMembers,
  onDeleteGroup,
  onUpdateExpense
}) {
  const [openMenuGroupId, setOpenMenuGroupId] = useState("");
  const [editingGroupId, setEditingGroupId] = useState("");
  const [openMembersGroupId, setOpenMembersGroupId] = useState("");
  const [pendingMemberIds, setPendingMemberIds] = useState([]);
  const [deleteGroup, setDeleteGroup] = useState(null);
  const [detailGroup, setDetailGroup] = useState(null);
  const [editingExpenseGroup, setEditingExpenseGroup] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    description: "",
    menuAmount: "",
    taxAmount: "",
    tipAmount: "",
    paidBy: "",
    splitType: "equal",
    exactShares: {}
  });
  const [expenseError, setExpenseError] = useState("");

  const friendOptions = useMemo(
    () => friends.map((friend) => ({ id: friend.id, name: friend.name, username: friend.username })),
    [friends]
  );
  const editingExpenseDetails =
    editingExpenseGroup && selectedGroupDetails?.group?._id === editingExpenseGroup._id ? selectedGroupDetails : null;

  useEffect(() => {
    if (!editingExpenseGroup || editingExpense || expenseError || !editingExpenseDetails) return;

    const firstExpense = editingExpenseDetails.expenses?.[0];
    if (firstExpense) {
      startExpenseEdit(editingExpenseDetails.group, firstExpense);
    } else {
      setExpenseError("No expenses to edit yet.");
    }
  }, [editingExpenseGroup, editingExpense, editingExpenseDetails, expenseError]);

  function startMemberEdit(group) {
    setOpenMenuGroupId("");
    setEditingGroupId(group._id);
    setPendingMemberIds(group.members.map((member) => member.user._id));
    onSelect(group._id);
  }

  function togglePendingMember(memberId) {
    if (memberId === currentUser?.id) return;
    setPendingMemberIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]
    );
  }

  async function handleUpdateMembers(groupId) {
    await onUpdateMembers(groupId, pendingMemberIds);
    setEditingGroupId("");
  }

  async function handleDeleteGroup() {
    if (!deleteGroup) return;
    await onDeleteGroup(deleteGroup._id);
    setDeleteGroup(null);
  }

  function startGroupExpenseEdit(group, details, isSettled) {
    setOpenMenuGroupId("");
    setEditingExpense(null);
    setEditingExpenseGroup(group);
    onSelect(group._id);

    if (isSettled) {
      setExpenseError("This group is settled, so expenses cannot be edited.");
      return;
    }

    setExpenseError("");
    const firstExpense = details?.expenses?.[0];
    if (firstExpense) {
      startExpenseEdit(group, firstExpense);
    }
  }

  function buildGroupReadme(details) {
    const expenses = details?.expenses || [];
    const members = details?.group?.members || [];
    const memberShares = new Map();
    const payerTotals = new Map();

    members.forEach((member) => {
      memberShares.set(member.user._id, {
        id: member.user._id,
        name: member.user.name,
        username: member.user.username,
        amount: 0
      });
      payerTotals.set(member.user._id, {
        id: member.user._id,
        name: member.user.name,
        amount: 0
      });
    });

    expenses.forEach((expense) => {
      const payerId = expense.paidBy?._id || expense.paidBy;
      if (payerTotals.has(payerId)) {
        const payer = payerTotals.get(payerId);
        payer.amount += Number(expense.amount || 0);
      }

      (expense.splits || []).forEach((split) => {
        const memberId = split.user?._id || split.user;
        if (memberShares.has(memberId)) {
          const member = memberShares.get(memberId);
          member.amount += Number(split.amount || 0);
        }
      });
    });

    return {
      totalSpent: expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
      splitTypes: [...new Set(expenses.map((expense) => splitTypeLabel(expense.splitType)))],
      payerTotals: [...payerTotals.values()].filter((payer) => payer.amount > 0),
      memberShares: [...memberShares.values()],
      expenses
    };
  }

  function startExpenseEdit(group, expense) {
    const taxAmount = Number(expense.taxAmount || 0);
    const tipAmount = Number(expense.tipAmount || 0);
    const menuAmount = Number(expense.menuAmount || Math.max(Number(expense.amount || 0) - taxAmount - tipAmount, 0));

    setOpenMenuGroupId("");
    setEditingExpenseGroup(group);
    setEditingExpense(expense);
    setExpenseError("");
    setExpenseForm({
      description: expense.description || "",
      menuAmount: String(menuAmount || ""),
      taxAmount: String(taxAmount || ""),
      tipAmount: String(tipAmount || ""),
      paidBy: expense.paidBy?._id || "",
      splitType: expense.splitType || "equal",
      exactShares: Object.fromEntries((expense.splits || []).map((split) => [split.user?._id || split.user, split.amount]))
    });
  }

  function buildExpenseSplits(totalAmount, members) {
    const memberIds = members.map((member) => member.user._id);
    if (!memberIds.length) throw new Error("Add members before editing an expense.");

    if (expenseForm.splitType === "equal") {
      return splitEqually(totalAmount, memberIds);
    }

    const splits = memberIds.map((memberId) => ({
      user: memberId,
      amount: Number(expenseForm.exactShares[memberId] || 0)
    }));
    const exactTotal = splits.reduce((sum, split) => sum + split.amount, 0);

    if (splits.some((split) => split.amount < 0)) {
      throw new Error("Exact amounts cannot be negative.");
    }
    if (Math.abs(exactTotal - totalAmount) > 0.01) {
      throw new Error("Exact amounts must add up to subtotal + tax + tip.");
    }

    return splits.map((split) => ({ ...split, amount: Number(split.amount.toFixed(2)) }));
  }

  async function handleUpdateExpense(group, expense) {
    const menuAmount = Number(expenseForm.menuAmount || 0);
    const taxAmount = Number(expenseForm.taxAmount || 0);
    const tipAmount = Number(expenseForm.tipAmount || 0);
    const totalAmount = Number((menuAmount + taxAmount + tipAmount).toFixed(2));

    if (!expenseForm.description.trim()) {
      setExpenseError("Enter an expense title.");
      return;
    }
    if (menuAmount <= 0 || taxAmount < 0 || tipAmount < 0) {
      setExpenseError("Subtotal must be positive. Tax and tip cannot be negative.");
      return;
    }
    if (!expenseForm.paidBy) {
      setExpenseError("Choose who paid.");
      return;
    }

    try {
      const splits = buildExpenseSplits(totalAmount, group.members);
      await onUpdateExpense(group._id, expense._id, {
        description: expenseForm.description.trim(),
        amount: totalAmount,
        menuAmount,
        taxAmount,
        tipAmount,
        paidBy: expenseForm.paidBy,
        category: expense.category || "General",
        splitType: expenseForm.splitType,
        splits
      });
      setEditingExpenseGroup(null);
      setEditingExpense(null);
      setExpenseError("");
    } catch (error) {
      setExpenseError(error.message);
    }
  }

  function renderExpenseEditForm(group, expense) {
    return (
      <div className="expense-edit-panel">
        {expenseError ? <p className="form-error">{expenseError}</p> : null}
        <input
          placeholder="Expense title"
          value={expenseForm.description}
          onChange={(event) => setExpenseForm({ ...expenseForm, description: event.target.value })}
        />
        <div className="money-row">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Subtotal"
            value={expenseForm.menuAmount}
            onChange={(event) => setExpenseForm({ ...expenseForm, menuAmount: event.target.value })}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Tax"
            value={expenseForm.taxAmount}
            onChange={(event) => setExpenseForm({ ...expenseForm, taxAmount: event.target.value })}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Tip"
            value={expenseForm.tipAmount}
            onChange={(event) => setExpenseForm({ ...expenseForm, tipAmount: event.target.value })}
          />
        </div>
        <select
          value={expenseForm.paidBy}
          onChange={(event) => setExpenseForm({ ...expenseForm, paidBy: event.target.value })}
        >
          <option value="">Who paid?</option>
          {group.members.map((member) => (
            <option key={member.user._id} value={member.user._id}>
              {member.user.name}
            </option>
          ))}
        </select>
        <div className="split-type-control">
          <button
            type="button"
            className={expenseForm.splitType === "equal" ? "active" : ""}
            onClick={() => setExpenseForm({ ...expenseForm, splitType: "equal" })}
          >
            Split equally
          </button>
          <button
            type="button"
            className={expenseForm.splitType === "exact" ? "active" : ""}
            onClick={() => setExpenseForm({ ...expenseForm, splitType: "exact" })}
          >
            Split by exact amount
          </button>
        </div>
        {expenseForm.splitType === "exact" ? (
          <div className="participant-list">
            <span>Exact amount each person spent</span>
            {group.members.map((member) => (
              <label className="participant-option" key={member.user._id}>
                <span>{member.user.name}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={expenseForm.exactShares[member.user._id] || ""}
                  onChange={(event) =>
                    setExpenseForm({
                      ...expenseForm,
                      exactShares: {
                        ...expenseForm.exactShares,
                        [member.user._id]: event.target.value
                      }
                    })
                  }
                />
              </label>
            ))}
          </div>
        ) : (
          <p className="empty-copy">
            {group.members.length
              ? `${money(
                  (Number(expenseForm.menuAmount || 0) +
                    Number(expenseForm.taxAmount || 0) +
                    Number(expenseForm.tipAmount || 0)) /
                    group.members.length
                )} each across ${group.members.length} people.`
              : ""}
          </p>
        )}
        <div className="member-editor-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setEditingExpenseGroup(null);
              setEditingExpense(null);
            }}
          >
            Cancel
          </button>
          <button type="button" className="friend-action" onClick={() => handleUpdateExpense(group, expense)}>
            Update expense
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h3>Your groups</h3>
          <p>{groups.length ? "Choose a group to see the bill breakdown." : "Create one to start splitting."}</p>
        </div>
      </div>
      <div className="stack-list">
        {groups.map((group) => {
          const isSelected = selectedGroupId === group._id;
          const details = selectedGroupDetails?.group?._id === group._id ? selectedGroupDetails : null;
          const unsettledTotal = groupUnsettledTotal(group);
          const status = unsettledTotal > 0 ? "Unsettled" : "Settled";
          const memberOptions = [
            ...group.members.map((member) => ({
              id: member.user._id,
              name: member.user.name,
              username: member.user.username
            })),
            ...friendOptions.filter((friend) => !group.members.some((member) => member.user._id === friend.id))
          ];

          return (
            <article className={`group-accordion ${isSelected ? "active" : ""}`} key={group._id}>
              <div className="group-tile-shell">
                <button
                  type="button"
                  className={`group-tile group-list-item ${isSelected ? "active" : ""}`}
                  onClick={() => {
                    setOpenMembersGroupId("");
                    setOpenMenuGroupId("");
                    setDetailGroup(group);
                    onSelect(group._id);
                  }}
                >
                  <div>
                    <strong>{group.name}</strong>
                    <p>{group.description || "Shared expenses and balances"}</p>
                  </div>
                  <div className="group-tile-meta">
                    <span className={`status-pill ${status === "Settled" ? "settled" : "unsettled"}`}>
                      {status}
                    </span>
                    <span
                      className="group-count member-count-trigger"
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenMembersGroupId((currentId) => (currentId === group._id ? "" : group._id));
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        event.stopPropagation();
                        setOpenMembersGroupId((currentId) => (currentId === group._id ? "" : group._id));
                      }}
                    >
                      {group.members.length} member{group.members.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </button>

                {openMembersGroupId === group._id ? (
                  <div className="group-members-popover">
                    <span>Members</span>
                    {group.members.map((member) => (
                      <div className="group-member-popover-row" key={member.user._id}>
                        <em>{initials(member.user.name)}</em>
                        <div>
                          <strong>{member.user.name}</strong>
                          <p>@{member.user.username}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="group-card-actions">
                  <button
                    type="button"
                    className="group-menu-button"
                    aria-label={`Actions for ${group.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenMenuGroupId((currentId) => (currentId === group._id ? "" : group._id));
                    }}
                  >
                    ...
                  </button>
                  {openMenuGroupId === group._id ? (
                    <div className="group-menu-popover">
                      <button
                        type="button"
                        onClick={() => startGroupExpenseEdit(group, details, status === "Settled")}
                      >
                        Edit
                      </button>
                      <button type="button" onClick={() => startMemberEdit(group)}>
                        Add friend
                      </button>
                      <button type="button" onClick={() => startMemberEdit(group)}>
                        Remove friend
                      </button>
                      <button
                        type="button"
                        className="danger-menu-item"
                        onClick={() => {
                          setOpenMenuGroupId("");
                          setDeleteGroup(group);
                        }}
                      >
                        Delete group
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {isSelected && editingGroupId === group._id ? (
                <div className="group-accordion-body atlas-group-expansion">
                  <div className="group-member-editor">
                    <div>
                      <strong>Update members</strong>
                      <p>Choose members, then press Update to confirm.</p>
                    </div>
                    <div className="member-editor-grid">
                      {memberOptions.map((member) => (
                        <label className="member-editor-option" key={member.id}>
                          <input
                            type="checkbox"
                            checked={pendingMemberIds.includes(member.id)}
                            disabled={member.id === currentUser?.id}
                            onChange={() => togglePendingMember(member.id)}
                          />
                          <span>
                            {member.name}
                            <em>@{member.username}</em>
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="member-editor-actions">
                      <button type="button" className="ghost-button" onClick={() => setEditingGroupId("")}>
                        Cancel
                      </button>
                      <button type="button" className="friend-action" onClick={() => handleUpdateMembers(group._id)}>
                        Update
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
        {!groups.length ? <p className="empty-copy">No groups yet. Create one to get started.</p> : null}
      </div>

      {deleteGroup ? (
        <div className="group-delete-overlay" role="presentation" onClick={() => setDeleteGroup(null)}>
          <section
            className="group-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-group-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="delete-group-title">Delete {deleteGroup.name}?</h3>
            <p>Deleting a group removes it here, but it does not settle any pending balances.</p>
            <div className="member-editor-actions">
              <button type="button" className="ghost-button" onClick={() => setDeleteGroup(null)}>
                Cancel
              </button>
              <button type="button" className="remove-friend-button" onClick={handleDeleteGroup}>
                Delete group
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {detailGroup ? (
        <div className="group-delete-overlay" role="presentation" onClick={() => setDetailGroup(null)}>
          <section
            className="group-readme-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="group-readme-title"
            onClick={(event) => event.stopPropagation()}
          >
            {(() => {
              const hasFullDetails = selectedGroupDetails?.group?._id === detailGroup._id;
              const readme = hasFullDetails ? buildGroupReadme(selectedGroupDetails) : buildGroupPreview(detailGroup);
              const group = hasFullDetails ? selectedGroupDetails.group : detailGroup;

              return (
                <>
                  <div className="group-readme-header">
                    <div>
                      <p className="eyebrow">Group Details</p>
                      <h3 id="group-readme-title">{group.name}</h3>
                      <span>{group.description || "Shared expenses and split details"}</span>
                    </div>
                    <button type="button" className="modal-close-button" onClick={() => setDetailGroup(null)} aria-label="Close group details">
                      X
                    </button>
                  </div>

                  <div className="group-readme-metrics">
                    <article>
                      <span>Total spent</span>
                      <strong>{money(readme.totalSpent)}</strong>
                    </article>
                    <article>
                      <span>Expenses</span>
                      <strong>{readme.expenses.length}</strong>
                    </article>
                    <article>
                      <span>Split method</span>
                      <strong>{readme.splitTypes.length ? readme.splitTypes.join(" + ") : "No expenses yet"}</strong>
                    </article>
                  </div>

                  <section className="group-readme-section">
                    <h4>Who paid</h4>
                    <div className="group-readme-list">
                      {readme.payerTotals.map((payer) => (
                        <div className="group-readme-row" key={payer.id}>
                          <span>{payer.name}</span>
                          <strong>{money(payer.amount)}</strong>
                        </div>
                      ))}
                      {!readme.payerTotals.length ? <p className="empty-copy">No payments recorded yet.</p> : null}
                    </div>
                  </section>

                  <section className="group-readme-section">
                    <h4>Member split</h4>
                    <div className="group-readme-list">
                      {readme.memberShares.map((member) => (
                        <div className="group-readme-row" key={member.id}>
                          <span>
                            {member.name}
                            <em>@{member.username}</em>
                          </span>
                          <strong>{money(member.amount)}</strong>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="group-readme-section">
                    <h4>Expense breakdown</h4>
                    <div className="group-readme-list">
                      {readme.expenses.map((expense) => (
                        <div className="group-readme-expense" key={expense._id}>
                          <div>
                            <strong>{expense.description}</strong>
                            <p>
                              {expense.paidBy?.name || "Someone"} paid {money(expense.amount)} • {splitTypeLabel(expense.splitType)}
                            </p>
                          </div>
                          <span>
                            subtotal {money(expense.menuAmount || expense.amount)} · tax {money(expense.taxAmount)} · tip {money(expense.tipAmount)}
                          </span>
                        </div>
                      ))}
                      {!readme.expenses.length ? <p className="empty-copy">No expenses saved in this group yet.</p> : null}
                    </div>
                  </section>
                </>
              );
            })()}
          </section>
        </div>
      ) : null}

      {editingExpenseGroup ? (
        <div
          className="group-delete-overlay"
          role="presentation"
          onClick={() => {
            setEditingExpenseGroup(null);
            setEditingExpense(null);
          }}
        >
          <section
            className="expense-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-expense-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <h3 id="edit-expense-title">Edit group expense</h3>
              <p>{editingExpenseGroup.name}</p>
            </div>
            {editingExpense ? (
              <>
                {editingExpenseDetails?.expenses?.length > 1 ? (
                  <select
                    className="expense-picker-select"
                    value={editingExpense._id}
                    onChange={(event) => {
                      const nextExpense = editingExpenseDetails.expenses.find(
                        (expense) => expense._id === event.target.value
                      );
                      if (nextExpense) startExpenseEdit(editingExpenseDetails.group, nextExpense);
                    }}
                  >
                    {editingExpenseDetails.expenses.map((expense) => (
                      <option key={expense._id} value={expense._id}>
                        {expense.description} - {money(expense.amount)}
                      </option>
                    ))}
                  </select>
                ) : null}
                {renderExpenseEditForm(editingExpenseDetails?.group || editingExpenseGroup, editingExpense)}
              </>
            ) : (
              <>
                <p className={expenseError ? "form-error" : "empty-copy"}>
                  {expenseError || "Loading expenses..."}
                </p>
                <div className="member-editor-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setEditingExpenseGroup(null);
                      setExpenseError("");
                    }}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
