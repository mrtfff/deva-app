// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// supabase/functions/_shared hem Edge Function'lar hem mobil hem testler tarafından
// tek kopyadan okunur.
config.watchFolders = [workspaceRoot];
config.resolver.aliasMap = {
  '@shared': path.resolve(workspaceRoot, 'supabase/functions/_shared'),
};

module.exports = config;