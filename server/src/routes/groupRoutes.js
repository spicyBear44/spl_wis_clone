const express = require("express");
const {
  listGroups,
  createGroup,
  getGroupDetails,
  createExpense,
  updateExpense,
  addGroupMember,
  updateGroupMembers,
  deleteGroup,
  createSettlement
} = require("../controllers/groupController");

const router = express.Router();

router.get("/", listGroups);
router.post("/", createGroup);
router.get("/:groupId", getGroupDetails);
router.delete("/:groupId", deleteGroup);
router.post("/:groupId/members", addGroupMember);
router.put("/:groupId/members", updateGroupMembers);
router.post("/:groupId/expenses", createExpense);
router.put("/:groupId/expenses/:expenseId", updateExpense);
router.post("/:groupId/settlements", createSettlement);

module.exports = router;
