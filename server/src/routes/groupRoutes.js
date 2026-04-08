const express = require("express");
const {
  listGroups,
  createGroup,
  getGroupDetails,
  createExpense,
  addGroupMember,
  createSettlement
} = require("../controllers/groupController");

const router = express.Router();

router.get("/", listGroups);
router.post("/", createGroup);
router.get("/:groupId", getGroupDetails);
router.post("/:groupId/members", addGroupMember);
router.post("/:groupId/expenses", createExpense);
router.post("/:groupId/settlements", createSettlement);

module.exports = router;
