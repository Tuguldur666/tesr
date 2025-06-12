const express = require('express');
const { connectToMongoDB } = require('./config/db');
const swaggerUi = require('swagger-ui-express');
const swaggerdoc = require('./swagger-output.json');
const errorHandler = require('./middleware/errorHandler');
const dotenv = require('dotenv');
const cors = require('cors');
const serverless = require('serverless-http');
const cookieParser = require('cookie-parser');
const mqttController = require('./controllers/httpEventController');
const mongoose = require('mongoose');
const SensorData = require('./models/data');

dotenv.config({ path: './config/config.env' });

const app = express();

app.use(express.json());

app.use(cors({
  origin: true,
  credentials: true
}));




app.use((req, res, next) => {
  if (req.method === 'POST' && (!req.body || Object.keys(req.body).length === 0)) {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      if (data) console.log(`⚠️ Raw body for ${req.path}:`, data);
      next();
    });
  } else {
    next();
  }
});


app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');


app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerdoc));


const userRouter = require('./routes/users');
app.use('/users', userRouter);

const verifyRouter = require('./routes/otps');
app.use('/otp', verifyRouter);

const mqtRouter = require('./routes/mqtt');
app.use('/mqt', mqtRouter);

const deviceRouter = require('./routes/device');
app.use('/device', deviceRouter);


app.post('/connection', mqttController.handleConnection);
app.post('/tele', mqttController.handleTele);
app.post('/stat', mqttController.handleStat);
app.post('/discooonection', mqttController.handleDisconnection);


app.get('/', (req, res) => {
  res.send('Hello from server.js!');
});


app.use(errorHandler);

async function check() {
  if (mongoose.connection.readyState !== 1) {
    console.log('⛔ Mongoose not connected. Skipping check().');
    return;
  }

  try {
    const count = await SensorData.countDocuments();
    console.log(`📦 Total documents in sensordatas: ${count}`);

    const latest = await SensorData.findOne().sort({ createdAt: -1 }).lean();
    console.log('🧾 Latest entry:', latest);
  } catch (err) {
    console.error('❌ Failed to check sensor data:', err);
  }
}


connectToMongoDB().then((mongooseInstance) => {
  app.locals.db = mongooseInstance;
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
  check();
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err);
});



module.exports.handler = serverless(app);
module.exports = app;
