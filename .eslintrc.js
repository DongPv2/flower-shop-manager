module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  rules: {
    // Tắt warning cho biến không sử dụng
    '@typescript-eslint/no-unused-vars': 'warn',
    // Các quy tắc khác có thể thêm ở đây
  }
};
