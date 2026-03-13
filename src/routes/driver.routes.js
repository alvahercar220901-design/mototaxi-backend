const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const { registerDriver, updateStatus, updateLocation } = require("../controllers/driver.controller");

router.post("/register", authMiddleware, registerDriver);
router.post("/status", authMiddleware, updateStatus);
router.post("/location", authMiddleware, updateLocation);

module.exports = router;
