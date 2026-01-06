module.exports = {
  extends: ['@commitlint/config-conventional'],
  // Disable default 100-char (or 72-char) header length limit for commit messages
  rules: {
    'header-max-length': [0, 'always', 100],
  },
};
