const express = require('express');
const router = express.Router();
const mqttController = require('../controllers/mqttController');

router.get('/data', mqttController.getLatestData);
router.post('/command', mqttController.sendCommand);
router.post('/automation', mqttController.setAutomation);


module.exports = router;
