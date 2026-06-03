const Note = require("../models/Note");

async function listNotes(req, res) {
  try {
    const notes = await Note.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20);
    return res.json(notes);
  } catch (error) {
    return res.status(500).json({ message: "Could not load notes.", error: error.message });
  }
}

async function createNote(req, res) {
  try {
    const text = (req.body.text || "").trim();
    if (!text) {
      return res.status(400).json({ message: "Note text is required." });
    }

    const note = await Note.create({
      user: req.user._id,
      text
    });

    return res.status(201).json(note);
  } catch (error) {
    return res.status(500).json({ message: "Could not save note.", error: error.message });
  }
}

module.exports = { listNotes, createNote };
