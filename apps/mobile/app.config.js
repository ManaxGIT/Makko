const { expo } = require('./app.json');

module.exports = {
  ...expo,
  plugins: [
    ...expo.plugins,
    ['expo-location', {
      locationWhenInUsePermission: 'Cho phép Makko dùng vị trí hiện tại để tìm đơn gần bạn và chọn điểm giao hàng.',
    }],
  ],
};
