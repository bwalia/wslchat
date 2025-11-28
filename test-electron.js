// Try requiring electron/main (ES module style for CJS)
const electron = require('electron/main');
console.log('electron:', typeof electron);
console.log('app:', electron.app);
