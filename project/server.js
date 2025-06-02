const express = require('express')
const {connectToMongoDB} = require('./db');
const swaggerUi = require('swagger-ui-express');
const swaggerdoc = require('./swagger-output.json')
const app = express()

app.set('view engine', 'ejs')

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerdoc));


app.get("/", (req, res)=> 
{
    res.render('index')
}
)

connectToMongoDB().then((mongooseInstance) => {
  app.locals.db = mongooseInstance;
  app.listen(3001);
});

const userRouter  = require('./routes/users')

app.use('/users' , userRouter)

