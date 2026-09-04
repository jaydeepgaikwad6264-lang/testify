try {
  require('./controllers/payment.controller');
  require('./routes/payment.routes');
  require('./app');
  console.log('OK');
} catch (e) {
  const fs = require('fs');
  const msg = (e && e.stack) ? e.stack : String(e);
  fs.writeFileSync('require-error.txt', msg);
  console.error(msg);
  process.exit(1);
}
