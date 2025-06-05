const express = require('express');
const router = express.Router();
const otpController = require("../controllers/otpController")


router.post('/verify', otpController.verifyUser);
// //////////////////////////////////



module.exports = router;