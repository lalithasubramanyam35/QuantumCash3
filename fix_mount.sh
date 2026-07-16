sed -i '/app.use("\/api", router);/d' server.js
sed -i '/app.use("\/.netlify\/functions\/api", router);/d' server.js
sed -i '/if (!process.env.LAMBDA_TASK_ROOT/i app.use("/api", router);\napp.use("/.netlify/functions/api", router);\n' server.js
