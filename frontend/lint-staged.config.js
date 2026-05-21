// lint-staged.config.js
export default {
  '*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    'git add',
  ],
  '*.{js,jsx}': [
    'eslint --fix',
    'prettier --write',
    'git add',
  ],
  '*.{css,scss}': [
    'prettier --write',
    'git add',
  ],
  '*.{json,md}': [
    'prettier --write',
    'git add',
  ],
};