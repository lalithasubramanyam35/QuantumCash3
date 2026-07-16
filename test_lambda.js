import { handler } from './netlify/functions/api.js';

const event = {
  path: '/.netlify/functions/api/buckets',
  httpMethod: 'GET',
  queryStringParameters: { scenario: 'stable' },
  headers: { 'host': 'localhost' },
  requestContext: {}
};

async function run() {
  const response = await handler(event, {});
  console.log(response);
}
run();
