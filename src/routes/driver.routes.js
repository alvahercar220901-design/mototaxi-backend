const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const { registerDriver, updateStatus } = require("../controllers/driver.controller");

router.post("/register", authMiddleware, registerDriver);
router.post("/status", authMiddleware, updateStatus);

module.exports = router;
