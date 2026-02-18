const { rmSync, cpSync } = require('fs');
const { join } = require('path');

rmSync(join('dist', 'templates'), { recursive: true, force: true });
cpSync(join('src', 'templates'), join('dist', 'templates'), { recursive: true });
