const express = require("express");
const {
  searchUsers,
  listFriends,
  addFriend,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend
} = require("../controllers/userController");

const router = express.Router();

router.get("/", searchUsers);
router.get("/friends", listFriends);
router.post("/friends", addFriend);
router.post("/friends/accept", acceptFriendRequest);
router.post("/friends/reject", rejectFriendRequest);
router.post("/friends/remove", removeFriend);

module.exports = router;
