const mqttService = require('../services/mqttServices');


exports.getLatestData = async (req, res) => {
  /*
    #swagger.tags = ['MQTT']
    #swagger.summary = 'Get Latest Temperature Data'
    #swagger.parameters['clientId'] = {
      in: 'query',
      required: false,
      type: 'string',
      description: 'Device ID to get latest sensor data for',
      example: 'VIOT_0D2BEC'
    }
    #swagger.responses[200] = {
      description: 'Latest sensor data',
      schema: { success: true, data: {} }
    }
    #swagger.responses[404] = {
      description: 'No sensor data available',
      schema: { success: false, message: 'No sensor data available' }
    }
  */
  try {
    const clientId = req.query.clientId; 
    const result = await mqttService.getLatestSensorData(clientId);
    res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.sendCommand = async (req, res) => {
  /*
    #swagger.tags = ['MQTT']
    #swagger.summary = 'Send TOGGLE command to device power topic'
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        clientId: ''
      }
    }
  */
  const { clientId } = req.body;

  if (!clientId || typeof clientId !== 'string') {
    return res.status(400).json({ success: false, message: 'Missing or invalid clientId' });
  }

  const topic = `cmnd/${clientId}/POWER`;
  const message = 'TOGGLE';

  try {
    const result = await mqttService.sendCommand(topic, message);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error('Error sending MQTT command:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};






exports.setAutomation = async (req, res) => {
  /*
    #swagger.tags = ['Automation']
    #swagger.summary = 'Set ON/OFF automation times for a device'
    #swagger.parameters['clientId'] = {
      in: 'path',
      required: true,
      type: 'string',
      description: 'Device client ID',
      example: 'clientId'
    }
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        topic: "cmnd/clientId/POWER",
        onTime: "07:30",
        offTime: "18:00",
        timezone: "Asia/Ulaanbaatar"
      }
    }
  */

  const deviceId = req.params.clientId;
  const {
    topic,
    onTime,
    offTime,
    timezone = 'Asia/Ulaanbaatar',
  } = req.body;

  if (!deviceId || !topic || !onTime || !offTime) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const result = await mqttService.setAutomationRule(deviceId, topic, onTime, offTime, timezone);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/////////////////////////////////////////////

exports.updateAutomationRuleById = async (req, res) => {
  const { ruleId } = req.params;
  const { topic, onTime, offTime, timezone } = req.body;

  if (!topic || !onTime || !offTime) {
    return res.status(400).json({ success: false, message: 'Missing required update fields' });
  }

  try {
    const updated = await mqttService.updateAutomationRuleById(
      ruleId,
      { topic, onTime, offTime, timezone },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Automation rule not found' });
    }

    res.json({ success: true, message: 'Automation rule updated', rule: updated });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate on/off time for this device' });
    }
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};
//////////////////////////////////////////

exports.getAutomationRulesByClientId = async (req, res) => {
  const { clientId } = req.params;

  if (!clientId) {
    return res.status(400).json({ success: false, message: 'Missing clientId' });
  }

  try {
    const rules = await mqttService.getAutomationRulesByClientId(clientId);
    res.json({ success: true, count: rules.length, rules });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

exports.deleteAutomationRuleById = async (req, res) => {
  const { ruleId } = req.params;

  try {
    const deleted = await mqttService.deleteAutomationRuleById(ruleId);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Automation rule not found' });
    }

    res.json({ success: true, message: 'Automation rule deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

///////////////////////

exports.getPowerLogs = async (req, res) => {
  const userId = req.params.userId
  try {
    const result = await mqttService.getPowerLogs(userId);
    res.json(result);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
