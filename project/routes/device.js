const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');


router.post('/registerDevices', deviceController.registerDevice);

router.get('/getUserDevice', deviceController.getDeviceById);

router.delete('/deleteDevice', deviceController.unregisterDevice);

module.exports = router;
