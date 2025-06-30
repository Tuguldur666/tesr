const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');


///////////////////////////////////////////////////////////////////
router.get('/getDevices', deviceController.getDevices);
//////////////////////////////////////////////////////////////////
router.get('/addUserToDevice', deviceController.addUserToDevice);
//////////////////////////////////////////////////////////////////
router.get('/removeUserFromDevice', deviceController.removeUserFromDevice);

module.exports = router;
