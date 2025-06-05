const express = require('express');
const router = express.Router();
const otpController = require("../controllers/otpController")


router.post('/verify', otpController.verifyUser);
// //////////////////////////////////
router.post('/forgot_pass', otpController.forgotPass);
// //////////////////////////////////
router.post('/verify_reset', otpController.verifyResetOtp);
// //////////////////////////////////
router.post('/reset_password' , otpController.resetPass);
// //////////////////////////////////



module.exports = router;