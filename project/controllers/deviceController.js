const deviceService = require('../services/deviceServices');


exports.registerDevice = async (req, res) => {
  /*
    #swagger.tags = ['Devices']
    #swagger.summary = 'Register a new device'
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        clientId: "VIOT_0D2BEC",
        entity: "SI7021",
        type: "th",
        userId: "64fa5db7cda63fd35f7c321a"
      }
    }
  */
  try {
    const { clientId, entity, category, type, metadata } = req.body;
    
    if (!clientId || !entity || !type) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const result = await deviceService.registerDevice(clientId, entity, category, type, metadata);
    
    if (!result.success) {
      return res.status(409).json(result); // Conflict: device already exists
    }

    res.status(201).json(result); // Created
  } catch (error) {
    res.status(503).json({ success: false, message: 'Service unavailable', error: error.message });
  }
};

//////////////////////////////////////////////
exports.getDeviceById = async (req, res) => {
  /*
    #swagger.tags = ['Devices']
    #swagger.summary = 'Get device details by deviceId'
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        accessToken: " "
      }
    }
  */
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ success: false, message: 'Missing access token' });
    }

    const device = await deviceService.getDevices(accessToken);
    
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    res.status(200).json(device);
  } catch (error) {
    res.status(503).json({ success: false, message: 'Service unavailable', error: error.message });
  }
};


exports.unregisterDevice = async (req, res) => {
  /*
    #swagger.tags = ['Devices']
    #swagger.summary = 'Unregister/delete a device'
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        accessToken: " ",
        clientId: "VIOT_0D2BEC",
        entity: "SI7021"
      }
    }
  */
  try {
    const { accessToken, clientId, entity } = req.body;

    if (!accessToken || !clientId || !entity) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const result = await deviceService.unregisterDevice(accessToken, clientId, entity);

    if (!result.success) {
      return res.status(404).json(result); // Not found or not owned
    }

    res.status(200).json(result); // OK
  } catch (error) {
    res.status(503).json({ success: false, message: 'Service unavailable', error: error.message });
  }
};
