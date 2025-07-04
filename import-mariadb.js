// import-mariadb.js
const fs = require("fs");
const mysql = require("mysql2/promise");

async function main() {
  // 1. 連接 MariaDB
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "cbs21",
    password: "094726@Info",
    database: "113_cbs21",
  });

  // 2. 讀取 JSON 檔
  const data = JSON.parse(fs.readFileSync("allStockData.json", "utf8"));

  // 3. 動態產生欄位
  const sample = data[0];
  const keys = Object.keys(sample);
  const placeholders = keys.map(() => "?").join(", ");
  const insertSQL = `INSERT INTO mimi_data (${keys
    .map((k) => `\`${k}\``)
    .join(", ")}) VALUES (${placeholders})`;

  // 4. 匯入資料
  for (const row of data) {
    const values = keys.map((k) => row[k]);
    await connection.execute(insertSQL, values);
  }

  await connection.end();
  console.log("匯入完成");
}

main().catch(console.error);
