// 可放通用工具函數，目前暫無特別需要
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
module.exports = {
  sleep,
};
