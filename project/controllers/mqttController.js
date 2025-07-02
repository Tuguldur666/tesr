const mqttService = require('../services/mqttServices');



//////////////////////////////////////////////////
exports.getLatestData = async (req, res) => {
  /*
    #swagger.tags = ['MQTT']
    #swagger.summary = 'Get Latest Temperature or Sensor Data'
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        clientId: 'VIOT_609EF0',
        entity: 'SI7021'
      }
    }
  */
  try {
    const { clientId, entity } = req.body;

    if (!clientId || !entity) {
      return res.status(400).json({ success: false, message: 'Missing required fields: clientId and entity' });
    }

    const result = await mqttService.getLatestSensorData(clientId, entity);

    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(503).json({ success: false, message: 'Service unavailable', error: error.message });
  }
};

/////////////////////////////////////////////////

exports.sendCommand = async (req, res) => {
  /*
    #swagger.tags = ['MQTT']
    #swagger.summary = 'Send command to toggle device power'
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        clientId: " ",
        entity: " "
      }
    }
  */
  const { clientId, entity } = req.body;

  if (!clientId || typeof clientId !== 'string') {
    return res.status(400).json({ success: false, message: 'Missing or invalid clientId' });
  }
  if (!entity) {
    return res.status(400).json({ success: false, message: 'Missing entity' });
  }

  try {
    const result = await mqttService.sendCommand(clientId, entity);
    res.status(result.success ? 200 : 503).json(result);
  } catch (error) {
    res.status(503).json({ success: false, message: error.message });
  }
};

///////////////////////////////////////////////////////

exports.setAutomation = async (req, res) => {
  /*
    #swagger.tags = ['Automation']
    #swagger.summary = 'Set ON/OFF automation times for a device'
    #swagger.parameters['Authorization'] = {
      in: 'header',
      description: 'Bearer access token',
      required: true,
      type: 'string'
    }
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        deviceId: " ",
        onTime: " ",
        offTime: " ",
        timezone : "Asia/Ulaanbaatar"
      }
    }
  */

  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Missing or invalid Authorization header' });
  }
  const accessToken = authHeader.split(' ')[1];

  const {
    deviceId,
    onTime,
    offTime,
    timezone = 'Asia/Ulaanbaatar',
  } = req.body;

  if (!accessToken || !deviceId || !onTime || !offTime) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const result = await mqttService.setAutomationRule(accessToken, deviceId , onTime, offTime, timezone);
    res.status(result.success ? 201 : 409).json(result);
  } catch (error) {
    res.status(503).json({ success: false, message: error.message });
  }
};

////////////////////////////////////////////////////////

exports.updateAutomationRuleById = async (req, res) => {
  /*
    #swagger.tags = ['Update automation']
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        ruleId: " ",
        onTime: " ",
        offTime: " ",
        timezone: " "
      }
    }
  */
  const { ruleId, onTime, offTime, timezone } = req.body;

  if (!ruleId || !onTime || !offTime) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const updated = await mqttService.updateAutomationRuleById(
      ruleId,
      { onTime, offTime, timezone },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Automation rule not found' });
    }

    res.status(200).json({ success: true, message: 'Automation rule updated', rule: updated });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate on/off time for this device' });
    }
    res.status(503).json({ success: false, message: 'Service error', error: err.message });
  }
};

//////////////////////////////////////////////////////////////

exports.getAutomationRulesByDeviceId = async (req, res) => {
  /*
    #swagger.tags = ['Get automation']
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      type: 'string'
    }
  */
  const { deviceId } = req.body;

  if (!deviceId) {
    return res.status(400).json({ success: false, message: 'Missing deviceId' });
  }

  try {
    const rules = await mqttService.getAutomationRulesByDeviceId(deviceId);
    res.status(200).json({ success: true, count: rules.length, rules });
  } catch (err) {
    res.status(503).json({ success: false, message: 'Service error', error: err.message });
  }
};


///////////////////////////////////////////////////////////

exports.deleteAutomationRuleById = async (req, res) => {
  /*
    #swagger.tags = ['Delete automation']
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        ruleId: " "
      }
    }
  */
  const { ruleId } = req.body;

  if (!ruleId) {
    return res.status(400).json({ success: false, message: 'Missing ruleId' });
  }

  try {
    const deleted = await mqttService.deleteAutomationRuleById(ruleId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Automation rule not found' });
    }

    res.status(200).json({ success: true, message: 'Automation rule deleted' });
  } catch (err) {
    res.status(503).json({ success: false, message: 'Service error', error: err.message });
  }
};

exports.getPowerLogs = async (req, res) => {
  /*
    #swagger.tags = ['Power Logs']
    #swagger.parameters['Authorization'] = {
      in: 'header',
      description: 'Bearer access token',
      required: true,
      type: 'string'
    }
  */
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Missing or invalid Authorization header' });
  }
  const accessToken = authHeader.split(' ')[1];

  if (!accessToken) {
    return res.status(400).json({ success: false, message: 'Missing accessToken' });
  }

  try {
    const result = await mqttService.getPowerLogs(accessToken);
    res.status(200).json(result);
  } catch (err) {
    res.status(503).json({ success: false, message: 'Service error', error: err.message });
  }
};
