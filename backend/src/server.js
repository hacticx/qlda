const app = require('./app');
const config = require('./config');
require('./db/database'); // tạo bảng nếu chưa có

app.listen(config.port, () => {
  console.log(`SmartHR M1 API: http://localhost:${config.port}/api  (AI_MODE=${config.ai.mode})`);
});
