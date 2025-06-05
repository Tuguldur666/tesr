const express = require('express');
const router = express.Router();
const userController = require("../controllers/userContoller")


router.post('/register', userController.registerUser);
// //////////////////////////////////
router.post('/login',userController.login );
// //////////////////////////////////
router.post('/refresh', userController.refreshToken);
// //////////////////////////////////
router.get('/getuser', userController.getUserData);


module.exports = router;


