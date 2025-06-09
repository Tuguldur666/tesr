const mqtt = require('mqtt');
const express = require('express');
const router = express.Router();

const client = mqtt.connect('http://192.168.1.253:18083/',{
    username: 'admin',
    password: 'Pass123$'
});

client.on('connect', () => {
    console.log('✅ Connected to EMQX Broker');
});

client.on('reconnect', () => {
    console.log('🔄 Reconnecting to MQTT broker...');
});

client.on('error', (err) => {
    console.error('❌ MQTT connection error:', err);
});

client.on('offline', () => {
    console.warn('⚠️ MQTT client is offline');
});

router.post('/send-mqtt', (req, res) => {
    const { topic, message } = req.body;

    console.log('📥 Incoming request:', { topic, message });

    if (!client.connected) {
        console.warn('⚠️ MQTT client is not connected. Cannot publish.');
        return res.status(503).send('MQTT client not connected');
    }

    client.publish(topic, message, {}, (err) => {
        if (err) {
            console.error('❌ Publish failed:', err);
            return res.status(500).send('Failed to publish message');
        }
        console.log(`📤 Successfully published to "${topic}":`, message);
        res.send('Published!');
    });
});

module.exports = router;
