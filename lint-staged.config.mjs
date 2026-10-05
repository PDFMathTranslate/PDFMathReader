export default {
  '*.{py,swift}': ['node scripts/native-style.mjs fix', 'node scripts/native-style.mjs check'],
  '*.{js,mjs,cjs,vue}': ['eslint --fix --max-warnings=0', 'prettier --write'],
  '*.{json,css,html,md,yml,yaml}': 'prettier --write',
};
