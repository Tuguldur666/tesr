const swaggerAutogen = require('swagger-autogen')();

const doc = {
  info: {
    title: '',
    description: 'Description'
  },
  host: 'localhost:3001'
};

const outputFile = './swagger-output.json';
const routes = ['./server.js'];


swaggerAutogen(outputFile, routes, doc);