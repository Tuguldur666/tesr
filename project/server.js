const express = require('express')
const {connectToMongoDB} = require('./config/db');
const swaggerUi = require('swagger-ui-express');
const swaggerdoc = require('./swagger-output.json')
const dotenv =require('dotenv');
const cors = require('cors');
const serverless = require('serverless-http');
const cookieParser = require('cookie-parser');
const app = express()
const result = dotenv.config({path:"./config/config.env"})

app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true })); 
app.set('view engine', 'ejs')
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerdoc));

app.get('/', (req, res) => {
  res.send('Hello from server.js!');
});



connectToMongoDB().then((mongooseInstance) => {
  app.locals.db = mongooseInstance;
  app.listen(3001);
});

const userRouter  = require('./routes/users')
app.use('/users' , userRouter)
module.exports.handler = serverless(app);

module.exports = app;
