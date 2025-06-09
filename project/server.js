const express = require('express');
const { connectToMongoDB } = require('./config/db');
const swaggerUi = require('swagger-ui-express');
const swaggerdoc = require('./swagger-output.json');
const errorHandler = require('./middleware/errorHandler');
const dotenv = require('dotenv');
const cors = require('cors');
const serverless = require('serverless-http');
const cookieParser = require('cookie-parser');

dotenv.config({ path: './config/config.env' });

const app = express();

app.use(cors({
  origin: true,          
  credentials: true       
}));

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');


app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerdoc));


const userRouter = require('./routes/users');
app.use('/users', userRouter);
const verifyRouter = require('./routes/otps');
app.use('/otp', verifyRouter);
const mqtRouter = require('./routes/mqt');
app.use('/mqt', mqtRouter);


app.get('/', (req, res) => {
  res.send('Hello from server.js!');
});

app.use(errorHandler);

connectToMongoDB().then((mongooseInstance) => {
  app.listen(3001);
  app.locals.db = mongooseInstance;
});


module.exports.handler = serverless(app);
module.exports = app;
