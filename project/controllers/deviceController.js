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
        type: "th"
      }
    }
    #swagger.parameters['Authorization'] = {
      in: 'header',
      description: 'Bearer access token',
      required: true,
      type: 'string'
    }
  */
  try {
    const { clientId, entity, type } = req.body;

    if (!clientId || !entity || !type) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Missing or invalid Authorization header' });
    }
    const accessToken = authHeader.split(' ')[1];

    const result = await deviceService.registerDevice(clientId, entity, type, accessToken);

    if (!result.success) {
      return res.status(409).json(result); 
    }

    res.status(201).json(result); 
  } catch (error) {
    res.status(503).json({ success: false, message: 'Service unavailable', error: error.message });
  }
};


//////////////////////////////////////////////
exports.getDeviceById = async (req, res) => {
  /*
    #swagger.tags = ['Devices']
    #swagger.summary = 'Get device details by deviceId'
    #swagger.parameters['Authorization'] = {
      in: 'header',
      description: 'Bearer access token',
      required: true,
      type: 'string'
    }
  */
  try {

    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Missing or invalid Authorization header' });
    }
    const accessToken = authHeader.split(' ')[1];

    const device = await deviceService.getDevices(accessToken);
    
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    res.status(200).json(device);
  } catch (error) {
    res.status(503).json({ success: false, message: 'Service unavailable', error: error.message });
  }
};

/////////////////////////////////////////////////////
exports.unregisterDevice = async (req, res) => {
  /*
    #swagger.tags = ['Devices']
    #swagger.summary = 'Unregister/delete a device'
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        clientId: "VIOT_0D2BEC",
        entity: "SI7021"
      }
    }
      #swagger.parameters['Authorization'] = {
      in: 'header',
      description: 'Bearer access token',
      required: true,
      type: 'string'
    }
  */
  try {

    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Missing or invalid Authorization header' });
    }
    const accessToken = authHeader.split(' ')[1];

    const {clientId, entity } = req.body;

    if (!accessToken || !clientId || !entity) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const result = await deviceService.unregisterDevice(accessToken, clientId, entity);

    if (!result.success) {
      return res.status(404).json(result); 
    }

    res.status(200).json(result); 
  } catch (error) {
    res.status(503).json({ success: false, message: 'Service unavailable', error: error.message });
  }
};
////////////////////////////////////////////////////

exports.getDevices = async (req, res) => {
  /*
    #swagger.tags = ['Devices']
    #swagger.summary = 'Get devices'
      #swagger.parameters['Authorization'] = {
      in: 'header',
      description: 'Bearer access token',
      required: true,
      type: 'string'
    }
  */
  try {

    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Missing or invalid Authorization header' });
    }
    const accessToken = authHeader.split(' ')[1];

    if (!accessToken) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const result = await deviceService.getDevices(accessToken);

    if (!result.success) {
      return res.status(404).json(result); 
    }

    res.status(200).json(result); 
  } catch (error) {
    res.status(503).json({ success: false, message: 'Service unavailable', error: error.message });
  }
};