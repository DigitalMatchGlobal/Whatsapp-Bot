// src\routes\meta.routes.js

const express = require("express");
const router = express.Router();
const { callbackOAuth } = require("../controllers/meta.controller");

router.get("/callback", callbackOAuth);

module.exports = router;
