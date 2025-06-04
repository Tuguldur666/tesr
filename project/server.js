const express = require('express')
const {connectToMongoDB} = require('./db');
const swaggerUi = require('swagger-ui-express');
const swaggerdoc = require('./swagger-output.json')
const dotenv =require('dotenv');
const app = express()
const result = dotenv.config({path:"./config.env"})

app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
app.set('view engine', 'ejs')


app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerdoc));

if (result.error) {
  console.error('Failed to load .env file:', result.error);
} else {
  console.log('Loaded env vars:', {
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  });
}


connectToMongoDB().then((mongooseInstance) => {
  app.locals.db = mongooseInstance;
  app.listen(3001);
});

const userRouter  = require('./routes/users')

app.use('/users' , userRouter)

