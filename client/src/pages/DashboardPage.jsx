import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { AddExpenseForm, CreateGroupForm, SettlementForm } from "../components/GroupForms";
import GroupList from "../components/GroupList";
import SummaryCards from "../components/SummaryCards";
import { dashboardApi, groupApi, noteApi, userApi } from "../services/api";

const socket = io("http://localhost:5001", { autoConnect: false });

const sidebarItems = [
  { id: "main", label: "Home", icon: "home" },
  { id: "groups", label: "Groups", icon: "groups" },
  { id: "activity", label: "Activity", icon: "activity" },
  { id: "settle", label: "Settle Up", icon: "settle" },
  { id: "account", label: "Profile", icon: "profile" }
];

const groupPanelTabs = [
  { id: "overview", label: "Group Overview", description: "Status across groups" },
  { id: "create", label: "Add Group", description: "Create a shared space" }
];

const settlePanelTabs = [
  { id: "settlement", label: "Settlements", description: "Record payments" },
  { id: "balances", label: "Balances", description: "Who owes whom" }
];

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function groupUnsettledTotal(group) {
  const total = group.members.reduce((sum, member) => sum + Math.abs(Number(member.balance || 0)), 0);
  return Number((total / 2).toFixed(2));
}

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function profilePhotoStorageKey(user) {
  const userKey = user?.id || user?._id || user?.username;
  return userKey ? `ws_profile_photo_${userKey}` : "";
}

function profileImageUrl(person) {
  return person?.profilePhoto || person?.profilePicture || person?.profileImage || person?.avatarUrl || person?.photoUrl || "";
}

function normalizePerson(person) {
  const imageUrl = profileImageUrl(person);

  return {
    id: person.id || person._id,
    name: person.name,
    username: person.username,
    profilePhoto: imageUrl,
    profilePicture: imageUrl,
    status: person.status
  };
}

function Avatar({ imageUrl, fullName = "", username = "", size = "md", className = "" }) {
  const fallback = initials(fullName || username);
  const altText = fullName || username ? `${fullName || username}'s profile picture` : "Profile picture";
  const classes = ["avatar", `avatar-${size}`, imageUrl ? "has-photo" : "", className].filter(Boolean).join(" ");

  return (
    <span className={classes}>
      {imageUrl ? <img src={imageUrl} alt={altText} /> : <span aria-hidden="true">{fallback}</span>}
    </span>
  );
}

function resizeProfilePhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const maxSize = 360;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Could not prepare that photo."));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };

      image.onerror = () => reject(new Error("Could not read that photo."));
      image.src = typeof reader.result === "string" ? reader.result : "";
    };

    reader.onerror = () => reject(new Error("Could not read that photo."));
    reader.readAsDataURL(file);
  });
}

export default function DashboardPage() {
  const { user, logout, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState("main");
  const [activeGroupPanel, setActiveGroupPanel] = useState("overview");
  const [activeSettlePanel, setActiveSettlePanel] = useState("balances");
  const [groupCreateStep, setGroupCreateStep] = useState("group");
  const [createdGroup, setCreatedGroup] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [friendsModalOpen, setFriendsModalOpen] = useState(false);
  const [addFriendModalOpen, setAddFriendModalOpen] = useState(false);
  const [requestsModalOpen, setRequestsModalOpen] = useState(false);
  const [friendsModalQuery, setFriendsModalQuery] = useState("");
  const [dashboard, setDashboard] = useState({
    summary: { totalGroups: 0, netBalance: 0, youAreOwed: 0, youOwe: 0 },
    groups: [],
    recentExpenses: [],
    recentSettlements: []
  });
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [pastNotesOpen, setPastNotesOpen] = useState(false);
  const [recentActivityOpen, setRecentActivityOpen] = useState(false);
  const [friendQuery, setFriendQuery] = useState("");
  const [friendMatches, setFriendMatches] = useState([]);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [friendSearchError, setFriendSearchError] = useState("");
  const [expandedFriendId, setExpandedFriendId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState("");
  const [profilePhotoError, setProfilePhotoError] = useState("");
  const [statusToast, setStatusToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const friendSearchRef = useRef(null);
  const profilePhotoInputRef = useRef(null);
  const statusToastTimeoutRef = useRef(null);

  const groupOverview = useMemo(() => {
    const unsettledGroups = dashboard.groups.filter((group) => groupUnsettledTotal(group) > 0).length;
    return {
      total: dashboard.groups.length,
      unsettled: unsettledGroups,
      settled: dashboard.groups.length - unsettledGroups
    };
  }, [dashboard.groups]);

  const filteredFriends = useMemo(() => {
    const query = friendsModalQuery.trim().toLowerCase();
    if (!query) return friends;
    return friends.filter((friend) => `${friend.name} ${friend.username}`.toLowerCase().includes(query));
  }, [friends, friendsModalQuery]);

  const recentActivities = useMemo(() => {
    const expenseItems = dashboard.recentExpenses.map((expense) => ({
      id: `expense-${expense._id}`,
      type: "expense",
      title: expense.description,
      detail: `${expense.paidBy.name} paid ${money(expense.amount)}${expense.category ? ` for ${expense.category}` : ""}`,
      amount: money(expense.amount),
      date: expense.expenseDate
    }));

    const settlementItems = dashboard.recentSettlements.map((settlement) => ({
      id: `settlement-${settlement._id}`,
      type: "settlement",
      title: `${settlement.fromUser.name} paid ${settlement.toUser.name}`,
      detail: settlement.note || "Recorded settlement",
      amount: money(settlement.amount),
      date: settlement.settledAt
    }));

    return [...expenseItems, ...settlementItems]
      .sort((first, second) => new Date(second.date) - new Date(first.date))
      .slice(0, 8);
  }, [dashboard.recentExpenses, dashboard.recentSettlements]);

  async function loadDashboard() {
    setLoading(true);
    try {
      const response = await dashboardApi.get();
      setDashboard(response);
      if (!selectedGroupId && response.groups[0]) {
        setSelectedGroupId(response.groups[0]._id);
      }
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadFriends() {
    try {
      const response = await userApi.listFriends();
      setFriends((response.friends || []).map(normalizePerson));
      setIncomingRequests((response.incomingRequests || []).map(normalizePerson));
      setOutgoingRequests((response.outgoingRequests || []).map(normalizePerson));
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  async function loadNotes() {
    try {
      const response = await noteApi.list();
      setNotes(response || []);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  async function loadGroup(groupId) {
    if (!groupId) return;
    try {
      const response = await groupApi.details(groupId);
      setSelectedGroup(response);
      socket.emit("group:join", groupId);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    socket.connect();
    socket.on("group:updated", ({ groupId }) => {
      if (groupId === selectedGroupId) {
        loadGroup(groupId);
      }
      loadDashboard();
    });

    return () => {
      socket.off("group:updated");
      socket.disconnect();
    };
  }, [selectedGroupId]);

  useEffect(() => {
    loadDashboard();
    loadFriends();
    loadNotes();
  }, []);

  useEffect(() => {
    return () => {
      if (statusToastTimeoutRef.current) {
        window.clearTimeout(statusToastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    loadGroup(selectedGroupId);
  }, [selectedGroupId]);

  useEffect(() => {
    if (friendsModalOpen || addFriendModalOpen || requestsModalOpen) {
      loadFriends();
    }
  }, [friendsModalOpen, addFriendModalOpen, requestsModalOpen]);

  useEffect(() => {
    setProfilePhotoPreview(profileImageUrl(user));
    setProfilePhotoError("");
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function searchFriends() {
      const query = friendQuery.trim();
      if (!query) {
        setFriendMatches([]);
        setFriendSearchError("");
        return;
      }

      setFriendSearchLoading(true);
      try {
        const results = await userApi.search(query);
        if (!cancelled) {
          const filtered = results.map(normalizePerson).filter((match) => !friends.some((friend) => friend.id === match.id));
          setFriendMatches(filtered);
          setFriendSearchError("");
        }
      } catch (searchError) {
        if (!cancelled) {
          setFriendSearchError(searchError.message);
        }
      } finally {
        if (!cancelled) {
          setFriendSearchLoading(false);
        }
      }
    }

    const timeoutId = window.setTimeout(searchFriends, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [friendQuery, friends]);

  function showStatusToast(title, message, variant = "success", duration = 2000) {
    if (statusToastTimeoutRef.current) {
      window.clearTimeout(statusToastTimeoutRef.current);
    }

    setStatusToast({ title, message, variant });

    if (duration) {
      statusToastTimeoutRef.current = window.setTimeout(() => {
        setStatusToast(null);
        statusToastTimeoutRef.current = null;
      }, duration);
    }
  }

  async function handleCreateGroup(payload) {
    const group = await groupApi.create(payload);
    setSelectedGroupId(group._id);
    await Promise.all([loadDashboard(), loadGroup(group._id)]);
    setActiveTab("groups");
    setActiveGroupPanel("create");
    showStatusToast("Group created", "Add the first expense when you are ready.");
    return group;
  }

  async function handleAddExpense(groupId, payload) {
    const response = await groupApi.addExpense(groupId, payload);
    await Promise.all([loadDashboard(), loadGroup(groupId)]);
    setSelectedGroupId(groupId);
    setActiveTab("groups");
    setActiveGroupPanel("overview");
    setGroupCreateStep("group");
    setCreatedGroup(null);
    return response;
  }

  async function handleUpdateExpense(groupId, expenseId, payload) {
    const response = await groupApi.updateExpense(groupId, expenseId, payload);
    await Promise.all([loadDashboard(), loadGroup(groupId)]);
    return response;
  }

  async function handleAddSettlement(payload) {
    const response = await groupApi.addSettlement(selectedGroupId, payload);
    await Promise.all([loadDashboard(), loadGroup(selectedGroupId)]);
    showStatusToast("Settled", "Payment recorded.");
    return response;
  }

  async function handleUpdateGroupMembers(groupId, memberIds) {
    await groupApi.updateMembers(groupId, { memberIds });
    await Promise.all([loadDashboard(), loadGroup(groupId)]);
  }

  async function handleDeleteGroup(groupId) {
    await groupApi.delete(groupId);
    if (selectedGroupId === groupId) {
      setSelectedGroupId("");
      setSelectedGroup(null);
    }
    await loadDashboard();
  }

  function handleSelectGroup(groupId) {
    if (groupId === selectedGroupId) return;
    setSelectedGroup(null);
    setSelectedGroupId(groupId);
  }

  async function handleAddFriend(friendId) {
    if (!friendId) return;
    await userApi.addFriend({ userId: friendId });
    await loadFriends();
    setFriendQuery("");
    setFriendMatches([]);
    setFriendSearchError("");
    showStatusToast("Request sent", "They will see it in their requests.");
  }

  async function handleAcceptFriend(friendId) {
    await userApi.acceptFriend({ userId: friendId });
    await loadFriends();
    showStatusToast("Friend added", "Request accepted.");
  }

  async function handleRejectFriend(friendId) {
    await userApi.rejectFriend({ userId: friendId });
    await loadFriends();
    showStatusToast("Request declined", "Friend request removed.");
  }

  async function handleRemoveFriend(friendId) {
    await userApi.removeFriend({ userId: friendId });
    setExpandedFriendId((currentId) => (currentId === friendId ? "" : currentId));
    await loadFriends();
  }

  function handleSidebarNavigate(itemId) {
    setActiveTab(itemId);
    if (itemId === "groups") setActiveGroupPanel("overview");
    if (itemId === "settle") setActiveSettlePanel("balances");
    setMobileMenuOpen(false);
  }

  async function handleSaveNote(event) {
    event.preventDefault();
    const text = noteText.trim();
    if (!text) return;

    setNoteSaving(true);
    try {
      await noteApi.create({ text });
      setNoteText("");
      await loadNotes();
      setPastNotesOpen(true);
      setError("");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleProfilePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    showStatusToast("Uploading photo...", "Almost there.", "loading", null);

    try {
      const photoData = await resizeProfilePhoto(file);
      const storageKey = profilePhotoStorageKey(user);
      const response = await userApi.updateProfilePhoto({ profilePhoto: photoData });
      const savedImageUrl = profileImageUrl(response.user);
      setProfilePhotoPreview(savedImageUrl);
      updateUser(response.user);
      const nextUser = normalizePerson(response.user);
      setFriends((current) => current.map((friend) => (friend.id === nextUser.id ? { ...friend, ...nextUser } : friend)));
      setIncomingRequests((current) => current.map((request) => (request.id === nextUser.id ? { ...request, ...nextUser } : request)));
      setOutgoingRequests((current) => current.map((request) => (request.id === nextUser.id ? { ...request, ...nextUser } : request)));
      setFriendMatches((current) => current.map((match) => (match.id === nextUser.id ? { ...match, ...nextUser } : match)));
      if (storageKey) {
        localStorage.setItem(storageKey, savedImageUrl);
      }
      await loadFriends();
      setProfilePhotoError("");
      showStatusToast("Photo updated", "Your new profile picture is saved.");
    } catch (photoError) {
      const message = photoError.message || "Could not save that photo.";
      setProfilePhotoError(message);
      setProfilePhotoPreview(profileImageUrl(user));
      showStatusToast("Upload failed", message, "error");
    } finally {
      event.target.value = "";
    }
  }

  function renderFriendAvatar(person) {
    const imageUrl = profileImageUrl(person);

    return (
      <Avatar
        imageUrl={imageUrl}
        fullName={person?.name}
        username={person?.username}
        className="friend-avatar"
      />
    );
  }

  function renderMainTab() {
    return (
      <section className="dashboard-section">
        <div className="hero-card">
          <div>
            <h1>Dashboard</h1>
            <p className="hero-copy">Keep your shared spending organized, balanced, and easy to settle.</p>
          </div>
          <div className="hero-side" />
        </div>

        <SummaryCards summary={dashboard.summary} />

        <div className="dashboard-columns">
          <section className="panel notes-panel">
            <h3>Add note</h3>
            <form className="note-form" onSubmit={handleSaveNote}>
              <textarea
                placeholder="add any reminders"
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
              />
              <button type="submit" disabled={noteSaving || !noteText.trim()}>
                {noteSaving ? "Saving..." : "Save note"}
              </button>
            </form>

            <div className="past-notes-accordion">
              <button
                type="button"
                className="past-notes-toggle"
                onClick={() => setPastNotesOpen((current) => !current)}
                aria-expanded={pastNotesOpen}
              >
                <span>Past notes</span>
                <em>{notes.length}</em>
              </button>

              {pastNotesOpen ? (
                <div className="past-notes-list">
                  {notes.slice(0, 8).map((note) => (
                    <article className="note-card" key={note._id}>
                      <p>{note.text}</p>
                      <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                    </article>
                  ))}
                  {!notes.length ? <p className="empty-copy">No notes yet.</p> : null}
                </div>
              ) : null}
            </div>
          </section>

          <section className="panel recent-activity-panel">
            <div className="recent-activity-accordion">
              <button
                type="button"
                className="recent-activity-toggle"
                onClick={() => setRecentActivityOpen((current) => !current)}
                aria-expanded={recentActivityOpen}
              >
                <span>Recent activities</span>
                <em>{recentActivities.length}</em>
              </button>

              {recentActivityOpen ? (
                <div className="recent-activity-list">
                  {recentActivities.map((activity) => (
                    <article className="activity-row" key={activity.id}>
                      <div>
                        <strong>{activity.title}</strong>
                        <p>
                          {activity.detail} • {new Date(activity.date).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={activity.type === "settlement" ? "activity-amount positive" : "activity-amount"}>
                        {activity.amount}
                      </span>
                    </article>
                  ))}
                  {!recentActivities.length ? (
                    <p className="empty-copy">No recent activity yet. Add an expense or settlement to get started.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </section>
    );
  }

  function renderGroupOverview() {
    return (
      <section className="atlas-content-panel">
        <div className="atlas-panel-header">
          <div>
            <p className="eyebrow">Groups</p>
            <h2>Group Overview</h2>
            <span>Quick status across your shared spaces.</span>
          </div>
        </div>

        <div className="atlas-metric-grid">
          <article>
            <span>Total groups</span>
            <strong>{groupOverview.total}</strong>
          </article>
          <article>
            <span>Unsettled groups</span>
            <strong>{groupOverview.unsettled}</strong>
          </article>
          <article>
            <span>Settled groups</span>
            <strong>{groupOverview.settled}</strong>
          </article>
        </div>

        <div className="atlas-section-card">
          <GroupList
            groups={dashboard.groups}
            selectedGroupId={selectedGroupId}
            selectedGroupDetails={selectedGroup}
            friends={friends}
            currentUser={user}
            onSelect={handleSelectGroup}
            onUpdateMembers={handleUpdateGroupMembers}
            onDeleteGroup={handleDeleteGroup}
            onUpdateExpense={handleUpdateExpense}
          />
        </div>
      </section>
    );
  }

  function renderBalancesPanel(sectionLabel = "Groups") {
    const suggestions = selectedGroup?.suggestions || [];

    return (
      <section className="atlas-content-panel">
        <div className="atlas-panel-header">
          <div>
            <p className="eyebrow">{sectionLabel}</p>
            <h2>Balances</h2>
            <span>See who owes whom for the selected group.</span>
          </div>
          <select className="atlas-inline-select" value={selectedGroupId} onChange={(event) => handleSelectGroup(event.target.value)}>
            <option value="">Select group</option>
            {dashboard.groups.map((group) => (
              <option key={group._id} value={group._id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>

        <div className="atlas-section-card">
          <h3>{selectedGroup?.group?.name || "No group selected"}</h3>
          <div className="stack-list">
            {suggestions.map((suggestion, index) => (
              <div
                className={`atlas-list-row balance-card ${suggestion.from._id === user?.id ? "is-negative" : suggestion.to._id === user?.id ? "is-positive" : ""}`}
                key={`${suggestion.from._id}-${suggestion.to._id}-${index}`}
              >
                <div>
                  <strong>
                    {suggestion.from._id === user?.id
                      ? `You owe ${suggestion.to.name}`
                      : `${suggestion.from.name} owes ${suggestion.to._id === user?.id ? "you" : suggestion.to.name}`}
                  </strong>
                  <p>{money(suggestion.amount)} remaining</p>
                </div>
                <span className="status-pill unsettled">Unsettled</span>
              </div>
            ))}
            {selectedGroupId && !suggestions.length ? <p className="empty-copy">Everyone is square right now.</p> : null}
            {!selectedGroupId ? <p className="empty-copy">Choose a group to view balances.</p> : null}
          </div>
        </div>
      </section>
    );
  }

  function renderSettlementsPanel(sectionLabel = "Groups") {
    return (
      <section className="atlas-content-panel">
        <div className="atlas-panel-header">
          <div>
            <p className="eyebrow">{sectionLabel}</p>
            <h2>Settlements</h2>
            <span>Record payments to settle outstanding balances.</span>
          </div>
        </div>
        <div className="atlas-split-content">
          <SettlementForm
            groups={dashboard.groups}
            selectedGroupId={selectedGroupId}
            onSelectGroup={handleSelectGroup}
            onAddSettlement={handleAddSettlement}
          />
          <div className="atlas-section-card">
            <h3>Recent settlements</h3>
            <div className="stack-list">
              {(selectedGroup?.settlements || dashboard.recentSettlements).slice(0, 6).map((settlement) => (
                <div className="atlas-list-row" key={settlement._id}>
                  <div>
                    <strong>
                      {settlement.fromUser.name} paid {settlement.toUser.name}
                    </strong>
                    <p>{settlement.note || "Recorded settlement"}</p>
                  </div>
                  <span>{money(settlement.amount)}</span>
                </div>
              ))}
              {!(selectedGroup?.settlements || dashboard.recentSettlements).length ? (
                <p className="empty-copy">No settlements recorded yet.</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    );
  }

  function renderCreateGroupPanel() {
    const expenseGroups = createdGroup && !dashboard.groups.some((group) => group._id === createdGroup._id)
      ? [createdGroup, ...dashboard.groups]
      : dashboard.groups;

    return (
      <section className="atlas-content-panel">
        <div className="atlas-panel-header">
          <div>
            <p className="eyebrow">Groups</p>
            <h2>Add Group</h2>
            <span>Create the group, then add its first expense.</span>
          </div>
        </div>

        <div className={`group-create-wizard ${groupCreateStep === "expense" ? "show-expense" : "show-group"}`}>
          <div className="wizard-step-track" aria-label="Add group progress">
            <span className={groupCreateStep === "group" ? "active" : "complete"}>Group</span>
            <span className={groupCreateStep === "expense" ? "active" : ""}>Expense</span>
          </div>

          {groupCreateStep === "group" ? (
            <div className="wizard-pane wizard-pane-group" key="group-step">
              <CreateGroupForm
                currentUser={user}
                onCreate={handleCreateGroup}
                onCreated={(group) => {
                  setCreatedGroup(group);
                  setSelectedGroupId(group._id);
                  setGroupCreateStep("expense");
                }}
                friends={friends}
                submitLabel="Next"
              />
            </div>
          ) : (
            <div className="wizard-pane wizard-pane-expense" key="expense-step">
              <div className="wizard-return-row">
                <button type="button" className="ghost-button" onClick={() => setGroupCreateStep("group")}>
                  Back
                </button>
                <span>{createdGroup?.name ? `Adding expense to ${createdGroup.name}` : "Add the first expense"}</span>
              </div>
              <AddExpenseForm
                groups={expenseGroups}
                selectedGroupId={selectedGroupId}
                currentUser={user}
                onSelectGroup={handleSelectGroup}
                onAddExpense={handleAddExpense}
              />
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderActiveGroupPanel() {
    if (activeGroupPanel === "overview") return renderGroupOverview();
    return renderCreateGroupPanel();
  }

  function renderActiveSettlePanel() {
    if (activeSettlePanel === "balances") return renderBalancesPanel("Settle Up");
    return renderSettlementsPanel("Settle Up");
  }

  function renderPanelShell({ title, subtitle, tabs, activePanel, onSelectPanel, children }) {
    return (
      <section className="groups-atlas-shell">
        <aside className="groups-atlas-sidebar" aria-label={`${title} actions`}>
          <div className="groups-sidebar-heading">
            <strong>{title}</strong>
            <span>{subtitle}</span>
          </div>
          <nav>
            {tabs.map((tab) => (
              <button
                type="button"
                className={activePanel === tab.id ? "active" : ""}
                onClick={() => onSelectPanel(tab.id)}
                key={tab.id}
              >
                <strong>{tab.label}</strong>
                <span>{tab.description}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="groups-atlas-main">{children}</main>
      </section>
    );
  }

  function renderGroupsTab() {
    return renderPanelShell({
      title: "Groups",
      tabs: groupPanelTabs,
      activePanel: activeGroupPanel,
      onSelectPanel: (panelId) => {
        setActiveGroupPanel(panelId);
        if (panelId === "create") {
          setGroupCreateStep("group");
          setCreatedGroup(null);
        }
      },
      children: renderActiveGroupPanel()
    });
  }

  function renderSettleTab() {
    return renderPanelShell({
      title: "Settle Up",
      tabs: settlePanelTabs,
      activePanel: activeSettlePanel,
      onSelectPanel: setActiveSettlePanel,
      children: renderActiveSettlePanel()
    });
  }

  function renderActivityTab() {
    return (
      <section className="atlas-content-panel activity-content-panel">
        <div className="atlas-panel-header">
          <div>
            <h2>Activity</h2>
          </div>
        </div>

        <section className="activity-grid">
          <section className="panel">
            <h3>Latest expenses</h3>
            <div className="stack-list">
              {dashboard.recentExpenses.map((expense) => (
                <div className="activity-row" key={expense._id}>
                  <div>
                    <strong>{expense.description}</strong>
                    <p>
                      {expense.paidBy.name} • {new Date(expense.expenseDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="exp-outgoing">
                    <span>{money(expense.amount)}</span>
                  </div>
                </div>
              ))}
              {!dashboard.recentExpenses.length ? <p className="empty-copy">No recent expenses yet.</p> : null}
            </div>
          </section>

          <section className="panel">
            <h3>Latest settlements</h3>
            <div className="stack-list">
              {dashboard.recentSettlements.map((settlement) => (
                <div className="activity-row" key={settlement._id}>
                  <div>
                    <strong>{settlement.fromUser.name}</strong>
                    <p>
                      paid {settlement.toUser.name} • {new Date(settlement.settledAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="exp-incoming">
                    <span>{money(settlement.amount)}</span>
                  </div>
                </div>
              ))}
              {!dashboard.recentSettlements.length ? <p className="empty-copy">No recent settlements yet.</p> : null}
            </div>
          </section>
        </section>
      </section>
    );
  }

  function renderAccountTab() {
    return (
      <section className="dashboard-section">
        <div className="account-card profile-card">
          <div className="profile-hero">
            <Avatar imageUrl={profilePhotoPreview} fullName={user?.name} username={user?.username} size="lg" className="profile-avatar" />
            <div className="profile-title-block">
              <p className="eyebrow">Profile</p>
              <h2>{user?.name}</h2>
              <p className="account-username">@{user?.username}</p>
            </div>
            <div className="profile-actions">
              <label className="ghost-button upload-photo-button">
                Upload photo
                <input ref={profilePhotoInputRef} type="file" accept="image/*" onChange={handleProfilePhotoChange} />
              </label>
              <button
                type="button"
                className="friend-action profile-edit-button"
                onClick={() => profilePhotoInputRef.current?.click()}
              >
                Edit Profile
              </button>
            </div>
          </div>
          {profilePhotoError ? <p className="profile-photo-error">{profilePhotoError}</p> : null}

          <div className="account-meta">
            <div className="summary-card">
              <span>Full name</span>
              <strong>{user?.name}</strong>
            </div>
            <div className="summary-card">
              <span>Username</span>
              <strong>@{user?.username}</strong>
            </div>
          </div>

          <div className="profile-footer-actions">
            <button className="ghost-button account-logout" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </section>
    );
  }

  function renderFriendsModal() {
    if (!friendsModalOpen) return null;

    return (
      <div className="friends-modal-overlay" role="presentation" onMouseDown={() => setFriendsModalOpen(false)}>
        <section className="friends-modal" role="dialog" aria-modal="true" aria-labelledby="friends-modal-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="friends-modal-header">
            <h2 id="friends-modal-title">Friends</h2>
            <div className="friends-modal-actions">
              <button
                type="button"
                className="friends-icon-button"
                onClick={() => {
                  setFriendsModalOpen(false);
                  setAddFriendModalOpen(true);
                }}
                aria-label="Add friend"
              >
                <span className="friends-icon add-friend" aria-hidden="true" />
                <span className="friends-button-text">Add friend</span>
              </button>
              <button
                type="button"
                className="friends-icon-button request-icon-button"
                onClick={() => {
                  setFriendsModalOpen(false);
                  setRequestsModalOpen(true);
                }}
                aria-label="Open friend requests"
              >
                <span className="friends-icon request-bell" aria-hidden="true" />
                {incomingRequests.length ? <em>{incomingRequests.length}</em> : null}
                <span className="friends-button-text">Requests</span>
              </button>
              <button type="button" className="modal-close-button" onClick={() => setFriendsModalOpen(false)} aria-label="Close friends">
                X
              </button>
            </div>
          </div>
          <input
            className="friends-modal-search"
            placeholder="Search friends"
            value={friendsModalQuery}
            onChange={(event) => setFriendsModalQuery(event.target.value)}
          />
          <div className="friends-modal-list">
            {filteredFriends.map((friend) => (
              <article className="friends-modal-row" key={friend.id}>
                {renderFriendAvatar(friend)}
                <div>
                  <strong>{friend.name}</strong>
                  <p>@{friend.username}</p>
                </div>
              </article>
            ))}
            {!filteredFriends.length ? <p className="empty-copy">No friends found.</p> : null}
          </div>
        </section>
      </div>
    );
  }

  function renderAddFriendModal() {
    if (!addFriendModalOpen) return null;

    return (
      <div className="friends-modal-overlay" role="presentation" onMouseDown={() => setAddFriendModalOpen(false)}>
        <section className="friends-modal" role="dialog" aria-modal="true" aria-labelledby="add-friend-modal-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="friends-modal-header">
            <h2 id="add-friend-modal-title">Add friend</h2>
            <button type="button" className="modal-close-button" onClick={() => setAddFriendModalOpen(false)} aria-label="Close add friend">
              X
            </button>
          </div>
          <input
            ref={friendSearchRef}
            className="friends-modal-search"
            placeholder="Search username"
            value={friendQuery}
            onChange={(event) => setFriendQuery(event.target.value)}
          />
          <div className="friends-modal-list">
            {friendSearchError ? <p className="form-error">{friendSearchError}</p> : null}
            {friendSearchLoading ? <p className="empty-copy">Searching...</p> : null}
            {friendMatches.map((match) => (
              <article className="friends-modal-row friend-search-result-row" key={match.id}>
                {renderFriendAvatar(match)}
                <div>
                  <strong>{match.name}</strong>
                  <p>@{match.username}</p>
                </div>
                {match.status === "incoming" ? (
                  <button type="button" className="friend-action" onClick={() => handleAcceptFriend(match.id)}>
                    Accept
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={match.status === "outgoing" || match.status === "friends"}
                    onClick={() => handleAddFriend(match.id)}
                  >
                    {match.status === "outgoing" ? "Sent" : match.status === "friends" ? "Friends" : "Add"}
                  </button>
                )}
              </article>
            ))}
            {friendQuery.trim() && !friendSearchLoading && !friendMatches.length && !friendSearchError ? (
              <p className="empty-copy">No users found.</p>
            ) : null}
            {!friendQuery.trim() ? <p className="empty-copy">Search by username to send a friend request.</p> : null}
          </div>
        </section>
      </div>
    );
  }

  function renderRequestsModal() {
    if (!requestsModalOpen) return null;

    return (
      <div className="friends-modal-overlay" role="presentation" onMouseDown={() => setRequestsModalOpen(false)}>
        <section className="friends-modal requests-modal" role="dialog" aria-modal="true" aria-labelledby="requests-modal-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="friends-modal-header">
            <h2 id="requests-modal-title">Friend requests</h2>
            <button type="button" className="modal-close-button" onClick={() => setRequestsModalOpen(false)} aria-label="Close requests">
              X
            </button>
          </div>

          <div className="friends-modal-list">
            <div className="request-section">
              <h3>Incoming</h3>
              {incomingRequests.map((request) => (
                <article className="friends-modal-row friend-search-result-row" key={request.id}>
                  {renderFriendAvatar(request)}
                  <div>
                    <strong>{request.name}</strong>
                    <p>@{request.username}</p>
                  </div>
                  <div className="friend-request-actions">
                    <button type="button" className="friend-action" onClick={() => handleAcceptFriend(request.id)}>
                      Accept
                    </button>
                    <button type="button" className="reject-button" onClick={() => handleRejectFriend(request.id)}>
                      Decline
                    </button>
                  </div>
                </article>
              ))}
              {!incomingRequests.length ? <p className="empty-copy">No incoming requests.</p> : null}
            </div>

            <div className="request-section">
              <h3>Sent</h3>
              {outgoingRequests.map((request) => (
                <article className="friends-modal-row" key={request.id}>
                  {renderFriendAvatar(request)}
                  <div>
                    <strong>{request.name}</strong>
                    <p>@{request.username}</p>
                  </div>
                  <span className="request-badge">Sent</span>
                </article>
              ))}
              {!outgoingRequests.length ? <p className="empty-copy">No sent requests.</p> : null}
            </div>
          </div>
        </section>
      </div>
    );
  }

  function renderActiveTab() {
    if (activeTab === "groups") return renderGroupsTab();
    if (activeTab === "settle") return renderSettleTab();
    if (activeTab === "activity") return renderActivityTab();
    if (activeTab === "account") return renderAccountTab();
    return renderMainTab();
  }

  return (
    <main className="dashboard-shell dashboard-shell-tabs">
      <header className="app-topbar">
        <button
          type="button"
          className="mobile-menu-button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileMenuOpen}
        >
          <span aria-hidden="true" />
        </button>
        <div className="brand-lockup">
          <img src="/images/wiselysplit-leaf-logo.svg" alt="" aria-hidden="true" />
          <span>WiselySplit</span>
        </div>
        <button type="button" className="friends-icon-button" onClick={() => setFriendsModalOpen(true)} aria-label="Open friends">
          <span className="friends-icon" aria-hidden="true" />
          {incomingRequests.length ? <em>{incomingRequests.length}</em> : null}
          <span className="friends-button-text">Friends</span>
        </button>
      </header>

      <div className="dashboard-app-body">
        <aside className="app-sidebar" aria-label="Dashboard sections">
          <div className="sidebar-prism" aria-hidden="true" />
          <nav>
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={activeTab === item.id ? "active" : ""}
                onClick={() => handleSidebarNavigate(item.id)}
              >
                <span className={`sidebar-icon ${item.icon}`} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-logout">
            <button type="button" onClick={logout}>
              <span className="sidebar-icon logout" aria-hidden="true" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        <section className="app-content">
          {error ? <p className="form-error">{error}</p> : null}
          {loading ? <p className="loading-copy">Loading your balances...</p> : null}
          {renderActiveTab()}
        </section>
      </div>

      {mobileMenuOpen ? (
        <div className="mobile-sidebar-layer" role="presentation">
          <button
            type="button"
            className="mobile-sidebar-overlay"
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="mobile-sidebar" aria-label="Mobile dashboard sections">
            <div className="mobile-sidebar-head">
              <div className="brand-lockup mobile-sidebar-brand">
                <img src="/images/wiselysplit-leaf-logo.svg" alt="" aria-hidden="true" />
                <span>WiselySplit</span>
              </div>
              <button type="button" className="mobile-sidebar-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
                <span aria-hidden="true" />
              </button>
            </div>
            <nav>
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={activeTab === item.id ? "active" : ""}
                  onClick={() => handleSidebarNavigate(item.id)}
                >
                  <span className={`sidebar-icon ${item.icon}`} aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="sidebar-logout">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
              >
                <span className="sidebar-icon logout" aria-hidden="true" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {statusToast ? (
        <div className={`status-toast dashboard-status-toast ${statusToast.variant === "loading" ? "is-loading" : ""} ${statusToast.variant === "error" ? "is-error" : ""}`} role="status" aria-live="polite">
          {statusToast.variant === "loading" ? <span className="status-spinner" aria-hidden="true" /> : null}
          {statusToast.variant === "success" ? <span className="status-check" aria-hidden="true">✓</span> : null}
          <div>
            <strong>{statusToast.title}</strong>
            <p>{statusToast.message}</p>
          </div>
        </div>
      ) : null}

      {renderFriendsModal()}
      {renderAddFriendModal()}
      {renderRequestsModal()}
    </main>
  );
}
