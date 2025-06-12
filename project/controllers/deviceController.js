const deviceService = require('../services/deviceServices');

/**
 * Controller for registering a new device
 */
/*
  #swagger.tags = ['Devices']
  #swagger.summary = 'Register a new device'
  #swagger.description = 'Registers a device with clientId, entity, category, type, metadata, and links it to a user by userId.'
  #swagger.parameters['body'] = {
    in: 'body',
    required: true,
    schema: {
      clientId: "VIOT_0D2BEC",
      entity: "SI7021",
      category: "temperature",
      type: "VIOT THR316D",
      topics: {
        sensor: "tele/VIOT_0D2BEC/SENSOR",
        status: "tele/VIOT_0D2BEC/STATE",
        statusCommand: "cmnd/VIOT_0D2BEC/STATUS"
      },
      metadata: {
        programVersion: "14.6.0",
        ipAddress: "192.168.1.142"
      },
      userId: "64fa5db7cda63fd35f7c321a" // ObjectId string
    }
  }
  #swagger.responses[201] = {
    description: 'Device registered successfully.',
    schema: {
      success: true,
      message: "Device registered",
      device: {
        _id: "684a42cf23696f096cb66b50",
        clientId: "VIOT_0D2BEC",
        entity: "SI7021",
        category: "temperature",
        type: "VIOT THR316D",
        metadata: {
          programVersion: "14.6.0",
          ipAddress: "192.168.1.142"
        },
        topics: {
          sensor: "tele/VIOT_0D2BEC/SENSOR",
          status: "tele/VIOT_0D2BEC/STATE",
          statusCommand: "cmnd/VIOT_0D2BEC/STATUS"
        },
        owner: "64fa5db7cda63fd35f7c321a",
        registeredAt: "2025-06-12T03:00:31.241Z"
      }
    }
  }
  #swagger.responses[409] = { description: 'Device already registered.' }
*/

exports.registerDevice = async (req, res) => {
  try {
    const { clientId, entity, category, type, metadata } = req.body;
    const result = await deviceService.registerDevice(clientId, entity, category, type, metadata);
    if (!result.success) {
      return res.status(409).json(result);
    }
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Controller for getting all devices
 */
/*
  #swagger.tags = ['Devices']
  #swagger.summary = 'Get all registered devices'
  #swagger.responses[200] = {
    description: 'List of devices.',
    schema: [{ deviceId: "VIOT_0D2BEC", category: "temperature", type: "VIOT THR316D" }]
  }
*/
exports.getAllDevices = async (req, res) => {
  try {
    const devices = await deviceService.getAllDevices();
    res.json(devices);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Controller for getting a device by ID
 */
/*
  #swagger.tags = ['Devices']
  #swagger.summary = 'Get device details by deviceId'
  #swagger.parameters['deviceId'] = {
    in: 'path',
    required: true,
    type: 'string',
    example: 'VIOT_0D2BEC'
  }
  #swagger.responses[200] = { description: 'Device found' }
  #swagger.responses[404] = { description: 'Device not found' }
*/
exports.getDeviceById = async (req, res) => {
  try {
    const device = await deviceService.getDevice(req.params.deviceId);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }
    res.json(device);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Controller for getting devices by category
 */
/*
  #swagger.tags = ['Devices']
  #swagger.summary = 'Get devices filtered by category'
  #swagger.parameters['category'] = {
    in: 'path',
    required: true,
    type: 'string',
    enum: ['temperature', 'motion', 'light', 'humidity', 'generic'],
    example: 'temperature'
  }
  #swagger.responses[200] = { description: 'Devices list filtered by category' }
*/
exports.getDevicesByCategory = async (req, res) => {
  try {
    const devices = await deviceService.getDevicesByCategory(req.params.category);
    res.json(devices);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Controller for updating a device
 */
/*
  #swagger.tags = ['Devices']
  #swagger.summary = 'Update device type and/or metadata'
  #swagger.parameters['deviceId'] = {
    in: 'path',
    required: true,
    type: 'string',
    example: 'VIOT_0D2BEC'
  }
  #swagger.parameters['body'] = {
    in: 'body',
    required: true,
    schema: {
      type: 'VIOT THR316D v2',
      metadata: {
        programVersion: '15.0.0'
      }
    }
  }
  #swagger.responses[200] = { description: 'Device updated successfully' }
  #swagger.responses[404] = { description: 'Device not found' }
*/
exports.updateDevice = async (req, res) => {
  try {
    const updateFields = req.body;
    const result = await deviceService.updateDevice(req.params.deviceId, updateFields);
    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Controller for unregistering a device
 */
/*
  #swagger.tags = ['Devices']
  #swagger.summary = 'Unregister/delete a device'
  #swagger.parameters['deviceId'] = {
    in: 'path',
    required: true,
    type: 'string',
    example: 'VIOT_0D2BEC'
  }
  #swagger.responses[200] = { description: 'Device unregistered successfully' }
  #swagger.responses[404] = { description: 'Device not found' }
*/
exports.unregisterDevice = async (req, res) => {
  try {
    const result = await deviceService.unregisterDevice(req.params.deviceId);
    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
