const express = require('express');
const router = express.Router();
const mqttController = require('../controllers/mqttController');

router.get('/data', mqttController.getLatestData);
router.post('/toggle', mqttController.sendCommand);
router.post('/automation/:clientId', mqttController.setAutomation);
router.put('/update/:ruleId', mqttController.updateAutomationRuleById);
router.get('/getRule/:clientId', mqttController.getAutomationRulesByClientId);
router.delete('/delete/:ruleId', mqttController.deleteAutomationRuleById);
router.get('/powerlogs/:userId', mqttController.getPowerLogs);

// /////////////////////////////////////////////////////////////

router.post('/connection', (req, res) => {
  console.log('Connection event received:', req.body);
  res.status(200).send('Connection event acknowledged');
});

router.post('/tele', (req, res) => {
  console.log('Telemetry data:', req.body);
  res.status(200).send('Telemetry received');
});

router.post('/teleKh', (req, res) => {
  console.log('Telemetry KhValue data:', req.body);
  res.status(200).send('teleKh received');
});

router.post('/stat', (req, res) => {
  console.log('Stat event:', req.body);
  res.status(200).send('Stat received');
});

router.post('/discooonection', (req, res) => {
  console.log('Disconnection event:', req.body);
  res.status(200).send('Disconnection received');
});



module.exports = router;
//sex