const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');


router.post('/registerDevices', deviceController.registerDevice);

router.get('/devices', deviceController.getAllDevices);

router.get('/devices/:deviceId', deviceController.getDeviceById);

router.get('/devices/category/:category', deviceController.getDevicesByCategory);

router.put('/updateDevices/:deviceId', deviceController.updateDevice);

router.delete('/devices/:deviceId', deviceController.unregisterDevice);

module.exports = router;
