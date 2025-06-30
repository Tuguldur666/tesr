const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');


///////////////////////////////////////////////////////////////////
router.get('/getDevices', deviceController.getDevices);
//////////////////////////////////////////////////////////////////
router.post('/addUserToDevice', deviceController.addUserToDevice);
//////////////////////////////////////////////////////////////////
router.post('/removeUserFromDevice', deviceController.removeUserFromDevice);

module.exports = router;
