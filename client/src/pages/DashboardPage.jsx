import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import GroupDetails from "../components/GroupDetails";
import { AddExpenseForm, CreateGroupForm } from "../components/GroupForms";
import GroupList from "../components/GroupList";
import SummaryCards from "../components/SummaryCards";
import { dashboardApi, groupApi, userApi } from "../services/api";

const socket = io("http://localhost:5001", { autoConnect: false });
const tabs = ["friends", "groups", "main", "activity", "account"];

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

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("main");
  const [dashboard, setDashboard] = useState({
    summary: { totalGroups: 0, netBalance: 0, youAreOwed: 0, youOwe: 0 },
    groups: [],
    recentExpenses: [],
    recentSettlements: []
  });
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [friendQuery, setFriendQuery] = useState("");
  const [friendMatches, setFriendMatches] = useState([]);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [friendSearchError, setFriendSearchError] = useState("");
  const [expandedFriendId, setExpandedFriendId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const friendSearchRef = useRef(null);

  const selectedGroupMeta = useMemo(
    () => dashboard.groups.find((group) => group._id === selectedGroupId),
    [dashboard.groups, selectedGroupId]
  );

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
      setFriends(response.friends || []);
      setIncomingRequests(response.incomingRequests || []);
      setOutgoingRequests(response.outgoingRequests || []);
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
  }, []);

  useEffect(() => {
    loadGroup(selectedGroupId);
  }, [selectedGroupId]);

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
          const filtered = results.filter((match) => !friends.some((friend) => friend.id === match.id));
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

  async function handleCreateGroup(payload) {
    await groupApi.create(payload);
    await loadDashboard();
    setActiveTab("groups");
  }

  async function handleAddExpense(payload) {
    await groupApi.addExpense(selectedGroupId, payload);
    await Promise.all([loadDashboard(), loadGroup(selectedGroupId)]);
  }

  async function handleAddSettlement(payload) {
    await groupApi.addSettlement(selectedGroupId, payload);
    await Promise.all([loadDashboard(), loadGroup(selectedGroupId)]);
  }

  async function handleAddMember(payload) {
    await groupApi.addMember(selectedGroupId, payload);
    await Promise.all([loadDashboard(), loadGroup(selectedGroupId)]);
  }

  async function handleAddFriend(friendId) {
    if (!friendId) return;
    await userApi.addFriend({ userId: friendId });
    await loadFriends();
    setFriendQuery("");
    setFriendMatches([]);
    setFriendSearchError("");
  }

  async function handleAcceptFriend(friendId) {
    await userApi.acceptFriend({ userId: friendId });
    await loadFriends();
  }

  async function handleRejectFriend(friendId) {
    await userApi.rejectFriend({ userId: friendId });
    await loadFriends();
  }

  async function handleRemoveFriend(friendId) {
    await userApi.removeFriend({ userId: friendId });
    setExpandedFriendId((currentId) => (currentId === friendId ? "" : currentId));
    await loadFriends();
  }

  function renderMainTab() {
    return (
      <section className="dashboard-section">
        <div className="hero-card">
          <div>
            <h1>WiselySplit That Benjamins</h1>
            <p className="hero-copy">Keep your shared spending organized, balanced, and easy to settle.</p>
          </div>
          <div className="hero-side">
            <div className="hero-profile">
              <strong>{user?.name}</strong>
              <span>@{user?.username}</span>
            </div>
          </div>
        </div>

        <SummaryCards summary={dashboard.summary} />

        <div className="dashboard-columns">
          <div>
            <GroupDetails details={selectedGroup} />
          </div>

          <section className="panel">
            <h3>Quick activity</h3>
            <div className="stack-list">
              {dashboard.recentExpenses.slice(0, 4).map((expense) => (
                <div className="activity-row" key={expense._id}>
                  <div>
                    <strong>{expense.description}</strong>
                    <p>
                      {expense.paidBy.name} paid in {expense.category}
                    </p>
                  </div>
                  <span>{money(expense.amount)}</span>
                </div>
              ))}
              {!dashboard.recentExpenses.length ? (
                <p className="empty-copy">No recent expenses yet. Add one from the Groups tab.</p>
              ) : null}
            </div>
          </section>
        </div>
      </section>
    );
  }

  function renderFriendsTab() {
    return (
      <section className="dashboard-section">
        <section className="friends-hero panel">
          <div>
            <h2>Friends</h2>
            <p>Manage friends, invite people into groups, and keep your circle ready for shared expenses.</p>
          </div>
        </section>

        <div className="friends-grid">
          <section className="panel friends-search-panel">
            <div className="friends-section-head">
              <div>
                <h3>Add Friends</h3>
                <p>Search by username to add people who already created an account.</p>
              </div>
            </div>

            <div className="friends-search-bar">
              <input
                ref={friendSearchRef}
                placeholder="Search username"
                value={friendQuery}
                onChange={(event) => setFriendQuery(event.target.value)}
              />
        
            </div>

            {friendSearchLoading ? <p className="empty-copy">Searching users...</p> : null}
            {friendSearchError ? <p className="form-error">{friendSearchError}</p> : null}
            {friendQuery.trim() && !friendSearchLoading && !friendMatches.length && !friendSearchError ? (
              <p className="empty-copy">No matching users found.</p>
            ) : null}

            <div className="friends-search-results">
              {friendMatches.slice(0, 4).map((match) => (
                <article className="friend-row" key={match.id}>
                  <div className="friend-row-main">
                    <div className="friend-avatar" aria-hidden="true">
                      {initials(match.name)}
                    </div>
                    <div>
                      <strong>{match.name}</strong>
                      <p>@{match.username}</p>
                    </div>
                  </div>
                  {match.status === "none" ? (
                    <button type="button" className="friend-action" onClick={() => handleAddFriend(match.id)}>
                      Add
                    </button>
                  ) : null}
                  {match.status === "incoming" ? (
                    <div className="friend-card-actions">
                      <button type="button" className="reject-button" onClick={() => handleRejectFriend(match.id)}>
                        Reject
                      </button>
                      <button type="button" className="friend-action" onClick={() => handleAcceptFriend(match.id)}>
                        Accept
                      </button>
                    </div>
                  ) : null}
                  {match.status === "outgoing" ? <span className="friend-status">Pending</span> : null}
                  {match.status === "friends" ? <span className="friend-status">Friends</span> : null}
                </article>
              ))}
            </div>
          </section>

          <section className="panel friend-requests-panel">
            <div className="friends-section-head">
              <div>
                <h3>Friend Requests</h3>
                <p>Incoming & outgoing</p>
              </div>
              <span className="request-badge">{incomingRequests.length + outgoingRequests.length}</span>
            </div>
            {incomingRequests.length || outgoingRequests.length ? (
              <div className="stack-list">
                {incomingRequests.map((request) => (
                  <article className="friend-row" key={`incoming-${request.id}`}>
                    <div className="friend-row-main">
                      <div className="friend-avatar" aria-hidden="true">
                        {initials(request.name)}
                      </div>
                      <div>
                        <strong>{request.name}</strong>
                        <p>@{request.username} sent you a request</p>
                      </div>
                    </div>
                    <div className="friend-card-actions">
                      <button type="button" className="reject-button" onClick={() => handleRejectFriend(request.id)}>
                        Reject
                      </button>
                      <button type="button" className="friend-action" onClick={() => handleAcceptFriend(request.id)}>
                        Accept
                      </button>
                    </div>
                  </article>
                ))}
                {outgoingRequests.map((request) => (
                  <article className="friend-row" key={`outgoing-${request.id}`}>
                    <div className="friend-row-main">
                      <div className="friend-avatar" aria-hidden="true">
                        {initials(request.name)}
                      </div>
                      <div>
                        <strong>{request.name}</strong>
                        <p>@{request.username} is waiting to accept</p>
                      </div>
                    </div>
                    <span className="friend-status">Pending</span>
                  </article>
                ))}
              </div>
            ) : (
              <>
                <div className="requests-illustration">
                  <img src="/images/friends-mascot.png" alt="Friendly mascot" className="requests-image" />
                </div>

                <div className="requests-empty-copy">
                  <strong>No requests yet</strong>
                </div>
              </>
            )}
          </section>
        </div>

        <section className="panel friends-list-panel">
          <div className="friends-section-head">
            <div>
              <h3>Your Friends</h3>
              <p>{friends.length ? `${friends.length} connected friend${friends.length === 1 ? "" : "s"}` : "Your added friends appear here."}</p>
            </div>
          </div>

          <div className="friends-list-grid">
            {friends.map((friend) => (
              <article className={`friend-card ${expandedFriendId === friend.id ? "expanded" : ""}`} key={friend.id}>
                <div className="friend-card-top">
                  <div className="friend-row-main">
                    <div className="friend-avatar" aria-hidden="true">
                      {initials(friend.name)}
                    </div>
                    <div>
                      <strong>{friend.name}</strong>
                      <p>@{friend.username}</p>
                    </div>
                  </div>
                  <div className="friend-card-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        setExpandedFriendId((currentId) => (currentId === friend.id ? "" : friend.id))
                      }
                    >
                      Edit
                    </button>
                    <span className="friend-status">Connected</span>
                  </div>
                </div>
                {expandedFriendId === friend.id ? (
                  <div className="friend-edit-panel">
                    <p>Manage this friendship.</p>
                    <button
                      type="button"
                      className="remove-friend-button"
                      onClick={() => handleRemoveFriend(friend.id)}
                    >
                      Remove friend
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
            {!friends.length ? <p className="empty-copy">No friends yet. Search for a username to add one.</p> : null}
          </div>
        </section>
      </section>
    );
  }

  function renderGroupsTab() {
    return (
      <section className="dashboard-section">
        <div className="dashboard-grid">
          <div className="left-rail">
            <CreateGroupForm onCreate={handleCreateGroup} />
            <GroupList
              groups={dashboard.groups}
              selectedGroupId={selectedGroupId}
              onSelect={setSelectedGroupId}
            />
          </div>

          <div className="content-rail">
            <AddExpenseForm
              group={selectedGroupMeta}
              currentUser={user}
              friends={friends}
              onAddExpense={handleAddExpense}
              onAddSettlement={handleAddSettlement}
              onAddMember={handleAddMember}
            />
            <GroupDetails details={selectedGroup} />
          </div>
        </div>
      </section>
    );
  }

  function renderActivityTab() {
    return (
      <section className="dashboard-section activity-grid">
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
                <span>{money(expense.amount)}</span>
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
                <span>{money(settlement.amount)}</span>
              </div>
            ))}
            {!dashboard.recentSettlements.length ? <p className="empty-copy">No recent settlements yet.</p> : null}
          </div>
        </section>
      </section>
    );
  }

  function renderAccountTab() {
    return (
      <section className="dashboard-section">
        <div className="account-card">
          <p className="eyebrow">Account</p>
          <h2>{user?.name}</h2>
          <p className="account-username">@{user?.username}</p>
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
          <button className="ghost-button account-logout" onClick={logout}>
            Logout
          </button>
        </div>
      </section>
    );
  }

  function renderActiveTab() {
    if (activeTab === "friends") return renderFriendsTab();
    if (activeTab === "groups") return renderGroupsTab();
    if (activeTab === "activity") return renderActivityTab();
    if (activeTab === "account") return renderAccountTab();
    return renderMainTab();
  }

  return (
    <main className="dashboard-shell dashboard-shell-tabs">
      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="loading-copy">Loading your balances...</p> : null}

      {renderActiveTab()}

      <nav className="bottom-nav" aria-label="Dashboard sections">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`nav-chip ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>
    </main>
  );
}
