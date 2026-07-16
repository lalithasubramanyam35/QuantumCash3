sed -i '/app.use('\''\/api'\'', router);/d' server.js
sed -i '/app.use('\''\/.netlify\/functions\/api'\'', router);/d' server.js
