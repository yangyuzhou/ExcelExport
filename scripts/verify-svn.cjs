const path = require('path');
const { verifyFiles } = require('../src/svn-runtime');
module.exports = async () => verifyFiles(path.join(__dirname,'..','build','svn-runtime'), require('../src/svn-runtime-manifest.json'));
