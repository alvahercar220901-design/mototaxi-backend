const express = require("express");
const router = express.Router();

const driverController = require("../controllers/driver.controller");

router.post("/status", driverController.updateStatus);

module.exports = router;
