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
