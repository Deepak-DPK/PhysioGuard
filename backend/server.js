const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = require('./src/app');
const { logger } = require('./src/utils/logger');
const { initScheduler } = require('./src/jobs/scheduler');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  initScheduler();
});
