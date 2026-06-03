const express = require("express");
const { createNote, listNotes } = require("../controllers/noteController");

const router = express.Router();

router.get("/", listNotes);
router.post("/", createNote);

module.exports = router;
