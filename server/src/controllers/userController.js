const User = require("../models/User");

async function searchUsers(req, res) {
  try {
    const query = (req.query.query || "").trim().toLowerCase();

    if (!query) {
      return res.json([]);
    }

    const currentUser = await User.findById(req.user._id).select(
      "friends incomingFriendRequests outgoingFriendRequests"
    );
    const users = await User.find({
      _id: { $ne: req.user._id },
      username: { $regex: `^${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, $options: "i" }
    })
      .select("name username")
      .sort({ username: 1 })
      .limit(8);

    return res.json(
      users.map((user) => ({
        id: user._id,
        name: user.name,
        username: user.username,
        status: currentUser.friends.some((id) => id.toString() === user._id.toString())
          ? "friends"
          : currentUser.outgoingFriendRequests.some((id) => id.toString() === user._id.toString())
            ? "outgoing"
            : currentUser.incomingFriendRequests.some((id) => id.toString() === user._id.toString())
              ? "incoming"
              : "none"
      }))
    );
  } catch (error) {
    return res.status(500).json({ message: "Could not search users.", error: error.message });
  }
}

async function listFriends(req, res) {
  try {
    const user = await User.findById(req.user._id)
      .populate("friends", "name username")
      .populate("incomingFriendRequests", "name username")
      .populate("outgoingFriendRequests", "name username");

    return res.json({
      friends: (user?.friends || []).map((friend) => ({
        id: friend._id,
        name: friend.name,
        username: friend.username
      })),
      incomingRequests: (user?.incomingFriendRequests || []).map((friend) => ({
        id: friend._id,
        name: friend.name,
        username: friend.username
      })),
      outgoingRequests: (user?.outgoingFriendRequests || []).map((friend) => ({
        id: friend._id,
        name: friend.name,
        username: friend.username
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: "Could not load friends.", error: error.message });
  }
}

async function addFriend(req, res) {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "A user is required." });
    }

    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot add yourself as a friend." });
    }

    const [currentUser, friend] = await Promise.all([
      User.findById(req.user._id),
      User.findById(userId)
    ]);

    if (!currentUser || !friend) {
      return res.status(404).json({ message: "User not found." });
    }

    const alreadyFriends = currentUser.friends.some((friendId) => friendId.toString() === userId);
    if (alreadyFriends) {
      return res.status(409).json({ message: "This user is already in your friends list." });
    }

    const alreadyOutgoing = currentUser.outgoingFriendRequests.some((friendId) => friendId.toString() === userId);
    if (alreadyOutgoing) {
      return res.status(409).json({ message: "Friend request already sent." });
    }

    const alreadyIncoming = currentUser.incomingFriendRequests.some((friendId) => friendId.toString() === userId);
    if (alreadyIncoming) {
      return res.status(409).json({ message: "This user already sent you a request. Accept it instead." });
    }

    currentUser.outgoingFriendRequests.push(friend._id);
    friend.incomingFriendRequests.push(currentUser._id);

    await Promise.all([currentUser.save(), friend.save()]);

    return res.status(201).json({ message: "Friend request sent." });
  } catch (error) {
    return res.status(500).json({ message: "Could not add friend.", error: error.message });
  }
}

async function acceptFriendRequest(req, res) {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "A user is required." });
    }

    const [currentUser, otherUser] = await Promise.all([
      User.findById(req.user._id),
      User.findById(userId)
    ]);

    if (!currentUser || !otherUser) {
      return res.status(404).json({ message: "User not found." });
    }

    const hasIncomingRequest = currentUser.incomingFriendRequests.some((id) => id.toString() === userId);
    if (!hasIncomingRequest) {
      return res.status(404).json({ message: "Friend request not found." });
    }

    currentUser.incomingFriendRequests = currentUser.incomingFriendRequests.filter(
      (id) => id.toString() !== userId
    );
    otherUser.outgoingFriendRequests = otherUser.outgoingFriendRequests.filter(
      (id) => id.toString() !== req.user._id.toString()
    );

    if (!currentUser.friends.some((id) => id.toString() === userId)) {
      currentUser.friends.push(otherUser._id);
    }
    if (!otherUser.friends.some((id) => id.toString() === req.user._id.toString())) {
      otherUser.friends.push(currentUser._id);
    }

    await Promise.all([currentUser.save(), otherUser.save()]);
    return res.json({ message: "Friend request accepted." });
  } catch (error) {
    return res.status(500).json({ message: "Could not accept request.", error: error.message });
  }
}

async function rejectFriendRequest(req, res) {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "A user is required." });
    }

    const [currentUser, otherUser] = await Promise.all([
      User.findById(req.user._id),
      User.findById(userId)
    ]);

    if (!currentUser || !otherUser) {
      return res.status(404).json({ message: "User not found." });
    }

    const hasIncomingRequest = currentUser.incomingFriendRequests.some((id) => id.toString() === userId);
    if (!hasIncomingRequest) {
      return res.status(404).json({ message: "Friend request not found." });
    }

    currentUser.incomingFriendRequests = currentUser.incomingFriendRequests.filter(
      (id) => id.toString() !== userId
    );
    otherUser.outgoingFriendRequests = otherUser.outgoingFriendRequests.filter(
      (id) => id.toString() !== req.user._id.toString()
    );

    await Promise.all([currentUser.save(), otherUser.save()]);
    return res.json({ message: "Friend request rejected." });
  } catch (error) {
    return res.status(500).json({ message: "Could not reject request.", error: error.message });
  }
}

async function removeFriend(req, res) {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "A user is required." });
    }

    const [currentUser, otherUser] = await Promise.all([
      User.findById(req.user._id),
      User.findById(userId)
    ]);

    if (!currentUser || !otherUser) {
      return res.status(404).json({ message: "User not found." });
    }

    const areFriends = currentUser.friends.some((id) => id.toString() === userId);
    if (!areFriends) {
      return res.status(404).json({ message: "Friend not found." });
    }

    currentUser.friends = currentUser.friends.filter((id) => id.toString() !== userId);
    otherUser.friends = otherUser.friends.filter((id) => id.toString() !== req.user._id.toString());

    await Promise.all([currentUser.save(), otherUser.save()]);
    return res.json({ message: "Friend removed." });
  } catch (error) {
    return res.status(500).json({ message: "Could not remove friend.", error: error.message });
  }
}

module.exports = {
  searchUsers,
  listFriends,
  addFriend,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend
};
