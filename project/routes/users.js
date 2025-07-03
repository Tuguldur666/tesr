const express = require('express');
const router = express.Router();
const userController = require("../controllers/userController")


router.post('/register', userController.registerUser);
// //////////////////////////////////
router.post('/login',userController.login );
// //////////////////////////////////
router.post('/refresh', userController.refreshToken);
// //////////////////////////////////
router.post('/updateUsername', userController.updateUsername);
////////////////////////////////////
router.get('/getuser', userController.getUserData);
////////////////////////////////////
router.post('/initiatePhoneNumber', userController.initiatePhoneNumberChange);
////////////////////////////////////
router.post('/verifyCurrentNumber', userController.verifyCurrentNumberAndSendOtpToNew);
////////////////////////////////////
router.post('/confirmNewPhoneNumber', userController.confirmNewPhoneNumber);
////////////////////////////////////



module.exports = router;


