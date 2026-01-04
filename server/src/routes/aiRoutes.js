const express = require("express");
const aiController = require("../controllers/aiController");

const router = express.Router();

router.post("/summarize", aiController.summarize);

module.exports = router;
