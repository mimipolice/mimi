<?php
// 匯入 allStockData.json 到 mimi_data 資料表

$mysqli = new mysqli('localhost', 'cbs21', '094726@Info', '113_cbs21');
if ($mysqli->connect_errno) {
    die("[錯誤] 連線失敗: " . $mysqli->connect_error . "\n");
} else {
    echo "[訊息] 成功連線到資料庫\n";
}

// 讀取 JSON 檔案
$json = file_get_contents('allStockData.json');
if ($json === false) {
    die("[錯誤] 讀取 allStockData.json 失敗\n");
} else {
    echo "[訊息] 成功讀取 allStockData.json\n";
}

$data = json_decode($json, true);
if (!$data || !is_array($data)) {
    die("[錯誤] JSON 解析失敗\n");
} else {
    echo "[訊息] JSON 解析成功，資料筆數: " . count($data) . "\n";
}

// 動態取得欄位
$sample = $data[0];
$keys = array_keys($sample);
$columns = '`' . implode('`,`', $keys) . '`';
$placeholders = implode(',', array_fill(0, count($keys), '?'));

// 檢查 mimi_data 是否存在，若不存在則建立
$tableExists = $mysqli->query("SHOW TABLES LIKE 'mimi_data'");
if ($tableExists === false) {
    die("[錯誤] 查詢資料表失敗: " . $mysqli->error . "\n");
}
if ($tableExists->num_rows == 0) {
    echo "[訊息] 資料表 mimi_data 不存在，準備自動建立...\n";
    // 動態產生 CREATE TABLE SQL
    $fields = [];
    foreach ($sample as $key => $value) {
        if (is_int($value)) {
            $fields[] = "`$key` INT";
        } elseif (is_float($value)) {
            $fields[] = "`$key` DOUBLE";
        } elseif ($key === 'time') {
            $fields[] = "`$key` DATETIME";
        } else {
            $fields[] = "`$key` VARCHAR(255)";
        }
    }
    $createSQL = "CREATE TABLE mimi_data (" . implode(", ", $fields) . ")";
    if (!$mysqli->query($createSQL)) {
        die("[錯誤] 自動建立資料表失敗: " . $mysqli->error . "\n");
    } else {
        echo "[訊息] 已自動建立 mimi_data 資料表\n";
    }
} else {
    echo "[訊息] 資料表 mimi_data 已存在\n";
}

// 預備語句
$stmt = $mysqli->prepare("INSERT INTO mimi_data ($columns) VALUES ($placeholders)");
if (!$stmt) {
    die("[錯誤] 預備語句失敗: " . $mysqli->error . "\n");
} else {
    echo "[訊息] 預備語句建立成功\n";
}

// 綁定型別
$types = '';
foreach ($sample as $value) {
    if (is_int($value) || is_float($value)) {
        $types .= 'd'; // double
    } else {
        $types .= 's'; // string
    }
}

$success = 0;
$fail = 0;
foreach ($data as $i => $row) {
    $params = [];
    foreach ($keys as $k) {
        $value = $row[$k];
        // ✅ 修正 time 格式
        if ($k === 'time') {
            $value = date('Y-m-d H:i:s', strtotime($value));
        }
        $params[] = $value;
    }
    if (!$stmt->bind_param($types, ...$params)) {
        echo "[錯誤] 第" . ($i + 1) . "筆綁定參數失敗: " . $stmt->error . "\n";
        $fail++;
        continue;
    }
    if (!$stmt->execute()) {
        echo "[錯誤] 第" . ($i + 1) . "筆插入失敗: " . $stmt->error . "\n";
        $fail++;
    } else {
        $success++;
    }
}

$stmt->close();
$mysqli->close();
echo "[完成] 匯入完成，成功: $success 筆，失敗: $fail 筆\n";
?>
