const deviceService = require('../services/deviceServices');


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
//////////////////////////////////////////////////////

exports.addUserToDevice = async (req, res) => {
  /*
    #swagger.tags = ['Users']
    #swagger.summary = 'Add user to device'
    #swagger.description = 'Links the authenticated user (via access token) to a device using device ID and phoneNumber'
    #swagger.parameters['Authorization'] = {
      in: 'header',
      name: 'Authorization',
      required: true,
      description: 'Bearer access token',
      type: 'string',
      example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    }
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        id: "DEVICE_OBJECT_ID",
        phoneNumber: 99881175
        name : "Custom name"
      }
    }
  */

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access token required' });
    }

    const accessToken = authHeader.split(' ')[1];
    const { id, phoneNumber, name } = req.body;

    if (!id || !phoneNumber || !name) {
      return res.status(422).json({ success: false, message: 'Missing device ID or phone number' });
    }

    const result = await deviceService.addDeviceToUser(id, phoneNumber.toString(),name, accessToken);


    return res.status(result.success ? 200 : 400).json(result);

  } catch (error) {
    console.error('addUserToDevice error:', error);
    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable. Please try again later.',
    });
  }
};

/////////////////////////////////////////////////////////////////////////

exports.removeUserFromDevice = async (req, res) => {
  /*
    #swagger.tags = ['Devices']
    #swagger.summary = 'Remove user from device'
    #swagger.description = 'Removes the authenticated user from the device owner list using access token.'
    #swagger.parameters['Authorization'] = {
      in: 'header',
      name: 'Authorization',
      required: true,
      description: 'Bearer access token',
      type: 'string',
      example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    }
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        id: "DEVICE_OBJECT_ID",
        phoneNumber: 99881175
      }
    }
  */

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access token required' });
    }

    const accessToken = authHeader.split(' ')[1];
    const { id, phoneNumber } = req.body;

    if (!id || !phoneNumber) {
      return res.status(422).json({ success: false, message: 'Device ID and phone number are required' });
    }

    const result = await deviceService.removeUserFromDevice(id, phoneNumber, accessToken);

    return res.status(result.success ? 200 : 400).json(result);

  } catch (err) {
    console.error('removeUserFromDevice error:', err);
    return res.status(503).json({ success: false, message: 'Internal server error' });
  }
};
/////////////////////////////////////////////////////////////////////////////////////////////

exports.getDeviceOwnersPhoneNumbers = async (req, res) => {
  /*
    #swagger.tags = ['Devices']
    #swagger.summary = 'Get phone numbers of users belonging to a device'
    #swagger.parameters['Authorization'] = {
      in: 'header',
      name: 'Authorization',
      required: true,
      description: 'Bearer access token',
      type: 'string',
      example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    }
    #swagger.parameters['body'] = {
      in: 'body',
      description: 'ID of the device',
      required: true,
      schema: { deviceId: 'DEVICE_OBJECT_ID' }
    }
  */

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access token required' });
    }

    const accessToken = authHeader.split(' ')[1];
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ success: false, message: 'Device ID is required' });
    }

    const result = await deviceService.getDeviceOwnersPhoneNumbers(deviceId,accessToken);

    if (!result.success) {
      return res.status(404).json({ success: false, message: result.message });
    }

    return res.status(200).json({ success: true, owners: result.owners });
  } catch (error) {
    console.error('Error in getDeviceOwnersPhoneNumbers controller:', error);
    return res.status(503).json({ success: false, message: 'Server error' });
  }
};
