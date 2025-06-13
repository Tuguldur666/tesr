const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');


router.post('/registerDevices', deviceController.registerDevice);

router.get('/devices', deviceController.getAllDevices);

router.get('/:clientId', deviceController.getDeviceById);

router.get('/category/:category', deviceController.getDevicesByCategory);

router.put('/updateDevices/:clientId', deviceController.updateDevice);

router.delete('/deleteDevices/:clientId', deviceController.unregisterDevice);

module.exports = router;
