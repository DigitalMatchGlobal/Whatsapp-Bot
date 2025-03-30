// Archivo: src/routes/webhook.routes.js
const express = require("express");
const router = express.Router();
const { handleWebhookPost, handleWebhookGet } = require("../controllers/webhook.controller");

router.get("/", handleWebhookGet);
router.post("/", handleWebhookPost);

module.exports = router;