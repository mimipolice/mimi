const { sleep } = require("../../utils/utils"); // 路徑依你的專案調整

class TaskQueue {
  constructor(concurrency = 1) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  async push(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.next();
    });
  }

  next() {
    if (this.running >= this.concurrency) return;
    const item = this.queue.shift();
    if (!item) return;
    this.running++;
    item
      .task()
      .then((result) => item.resolve(result))
      .catch((err) => item.reject(err))
      .finally(async () => {
        this.running--;
        console.log("sleep for 1 second");
        await sleep(1000);
        console.log("next"); // 每次任務間隔1秒
        this.next();
      });
  }
}

module.exports = TaskQueue;
