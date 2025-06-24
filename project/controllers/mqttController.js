const mqttService = require('../services/mqttServices');


exports.getConnectedDevices = async (req, res) => {
  /*
    #swagger.tags = ['MQTT']
    #swagger.summary = 'Get all currently connected devices'
  */
  try {
    const result = await mqttService.getConnectedDevices();
    res.status(result.success ? 200 : 500).json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Unexpected error', error: err.message });
  }
};

//////////////////////////////////////////////////
exports.getLatestData = async (req, res) => {
  /*
    #swagger.tags = ['MQTT']
    #swagger.summary = 'Get Latest Temperature Data'
    #swagger.parameters['body'] = {
      in: 'body',
      required: false,
      schema: {
        clientId: " ",
        entity: " "
      }
    }
  */
  try {
    const { clientId, entity } = req.body;
    if (!clientId && !entity) {
      return res.status(400).json({ success: false, message: 'Missing field' });
    }

    const result = await mqttService.getLatestSensorData(clientId, entity);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(503).json({ success: false, message: error.message });
  }
};

/////////////////////////////////////////////////

exports.sendCommand = async (req, res) => {
  /*
    #swagger.tags = ['MQTT']
    #swagger.summary = 'Get Latest Temperature Data'
    #swagger.parameters['body'] = {
      in: 'body',
      required: false,
      schema: {
        clientId: " ",
        entity: " "
      }
    }
  */
  const { clientId ,entity} = req.body;

  if (!clientId || typeof clientId !== 'string') {
    return res.status(400).json({ success: false, message: 'Missing or invalid clientId' });
  }
  if (!clientId && !entity) {
      return res.status(400).json({ success: false, message: 'Missing field' });
  }

  try {
    const result = await mqttService.sendCommand(clientId , entity);
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
    #swagger.parameters['body'] = {
      in: 'body',
      required: false,
       schema: {
        accessToken: " ",
        clientId: " ",
        entity: " ",
        onTime: " ",
        offTime: " ",
        timezone : "Asia/Ulaanbaatar"
      }
    }
  */
  const {
    accessToken,
    clientId,
    entity,
    onTime,
    offTime,
    timezone = 'Asia/Ulaanbaatar',
  } = req.body;

  if (!accessToken || !clientId || !entity || !onTime || !offTime) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const result = await mqttService.setAutomationRule(accessToken, clientId, entity, onTime, offTime, timezone);
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
      required: false,
      schema : {
      ruleId : " ",
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

exports.getAutomationRulesByClientId = async (req, res) => {
  /*
    #swagger.tags = ['Get automation']
    #swagger.parameters['body'] = {
      in: 'body',
      required: false,
      schema : {
      clientId: " ",
      entity: " "
      },
  }
  */
  const { clientId, entity } = req.body;

  if (!clientId) {
    return res.status(400).json({ success: false, message: 'Missing clientId' });
  }

  try {
    const rules = await mqttService.getAutomationRulesByClientId(clientId, entity);
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
      required: false,
      schema: {
      ruleId: " "
      }
  */
  const ruleId  = req.body;

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
    #swagger.parameters['body'] = {
      in: 'body',
      required: false,
      schema : { 
      accessToken : " "
      }
    }
  */
  const accessToken = req.body;

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