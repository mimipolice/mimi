<?php
// import-api.php: AJAX 匯入 API，支援 action=start, action=progress
header('Content-Type: application/json; charset=utf-8');

$progressFile = __DIR__ . '/import-progress.json';
$log = [];
function logmsg($msg, $type = 'info') {
    global $log;
    $color = $type === 'error' ? 'text-error' : ($type === 'warn' ? 'text-warning' : 'text-success');
    $log[] = "<span class='$color'>" . htmlspecialchars($msg) . "</span>";
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
if ($action === 'progress') {
    // 新增：回傳 DB 筆數、JSON 總筆數、進度百分比
    $db_count = 0;
    $json_count = 0;
    $progress = 0;
    // 取得 DB 筆數
    $mysqli = @new mysqli('localhost', 'cbs21', '094726@Info', '113_cbs21');
    if (!$mysqli->connect_errno) {
        $res = $mysqli->query('SELECT COUNT(*) as cnt FROM mimi_data');
        if ($res && ($row = $res->fetch_assoc())) {
            $db_count = intval($row['cnt']);
        }
        $mysqli->close();
    }
    // 取得 JSON 筆數
    $json = @file_get_contents(__DIR__ . '/allStockData.json');
    if ($json !== false) {
        $arr = @json_decode($json, true);
        if (is_array($arr)) $json_count = count($arr);
    }
    if ($json_count > 0) {
        $progress = min(100, round($db_count / $json_count * 100));
    }
    // 讀取進度檔
    $data = [];
    if (file_exists($progressFile)) {
        $data = json_decode(file_get_contents($progressFile), true) ?: [];
    }
    $data['db_count'] = $db_count;
    $data['json_count'] = $json_count;
    $data['progress'] = $progress;
    echo json_encode($data);
    exit;
}
if ($action !== 'start') {
    echo json_encode(["error"=>"未知 action"]);
    exit;
}

// 匯入參數
set_time_limit(0);
$batchSize = 200; // 每批匯入筆數，可依效能調整

// 1. 讀取 JSON
$json = file_get_contents(__DIR__ . '/allStockData.json');
if ($json === false) {
    logmsg("[錯誤] 讀取 allStockData.json 失敗", 'error');
    saveProgress('失敗', 0, 0, $log);
    exit(json_encode(["status"=>"失敗","log"=>$log]));
}
$data = json_decode($json, true);
if (!$data || !is_array($data)) {
    logmsg("[錯誤] JSON 解析失敗", 'error');
    saveProgress('失敗', 0, 0, $log);
    exit(json_encode(["status"=>"失敗","log"=>$log]));
}
$total = count($data);

// 2. 連線 DB
$mysqli = new mysqli('localhost', 'cbs21', '094726@Info', '113_cbs21');
if ($mysqli->connect_errno) {
    logmsg("[錯誤] 連線失敗: " . $mysqli->connect_error, 'error');
    saveProgress('失敗', 0, $total, $log);
    exit(json_encode(["status"=>"失敗","log"=>$log]));
}

// 3. 檢查/建立資料表
$sample = $data[0];
$keys = array_keys($sample);
$tableExists = $mysqli->query("SHOW TABLES LIKE 'mimi_data'");
if ($tableExists === false) {
    logmsg("[錯誤] 查詢資料表失敗: " . $mysqli->error, 'error');
    saveProgress('失敗', 0, $total, $log);
    exit(json_encode(["status"=>"失敗","log"=>$log]));
}
if ($tableExists->num_rows == 0) {
    logmsg("[訊息] 資料表 mimi_data 不存在，準備自動建立...");
    $fields = ["`id` INT AUTO_INCREMENT PRIMARY KEY"];
    foreach ($sample as $key => $value) {
        if ($key === 'id') continue;
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
        logmsg("[錯誤] 自動建立資料表失敗: " . $mysqli->error, 'error');
        saveProgress('失敗', 0, $total, $log);
        exit(json_encode(["status"=>"失敗","log"=>$log]));
    } else {
        logmsg("[訊息] 已自動建立 mimi_data 資料表");
    }
} else {
    logmsg("[訊息] 資料表 mimi_data 已存在");
}

// 4. 查詢 DB 最後一筆資料
$lastRow = null;
$result = $mysqli->query("SELECT * FROM mimi_data ORDER BY time DESC LIMIT 1");
if ($result && $result->num_rows > 0) {
    $lastRow = $result->fetch_assoc();
    logmsg("[訊息] DB 最後一筆 time: " . $lastRow['time']);
} else {
    logmsg("[訊息] DB 尚無資料，將從頭匯入");
}

// 5. 找到 JSON 中對應 time 的 index
$startIndex = 0;
if ($lastRow) {
    foreach ($data as $i => $row) {
        $rowTime = date('Y-m-d H:i:s', strtotime($row['time']));
        if ($rowTime === $lastRow['time']) {
            $startIndex = $i + 1;
            break;
        }
    }
}
if ($startIndex > 0) {
    logmsg("[訊息] 將從第 $startIndex 筆資料開始匯入");
}
$dataToInsert = array_slice($data, $startIndex);
if (count($dataToInsert) === 0) {
    logmsg("[訊息] 無需匯入新資料");
    saveProgress('無需匯入新資料', $total, $total, $log);
    exit(json_encode(["status"=>"無需匯入新資料","log"=>$log,"success"=>$total,"total"=>$total]));
}

// 6. 分批匯入（多值批次 INSERT + transaction）
$success = $startIndex;
$fail = 0;
$mysqli->autocommit(false); // 關閉自動提交，加速批次
for ($i = 0; $i < count($dataToInsert); $i += $batchSize) {
    $batch = array_slice($dataToInsert, $i, $batchSize);
    $valuesArr = [];
    $params = [];
    foreach ($batch as $row) {
        $placeholdersArr = [];
        foreach ($keys as $k) {
            $value = $row[$k];
            if ($k === 'time') {
                $value = date('Y-m-d H:i:s', strtotime($value));
            }
            $params[] = $mysqli->real_escape_string($value);
            $placeholdersArr[] = "'" . $mysqli->real_escape_string($value) . "'";
        }
        $valuesArr[] = '(' . implode(',', $placeholdersArr) . ')';
    }
    $sql = "INSERT INTO mimi_data (`" . implode('`,`', $keys) . "`) VALUES " . implode(',', $valuesArr);
    if (!$mysqli->query($sql)) {
        logmsg("[錯誤] 批次插入失敗: " . $mysqli->error, 'error');
        $fail += count($batch);
    } else {
        $success += count($batch);
    }
    saveProgress("匯入中", $success, $total, $log);
    usleep(1000); // 0.1 秒，避免過度佔用資源
}
$mysqli->commit();
$mysqli->autocommit(true);
$mysqli->close();
logmsg("[完成] 匯入完成，成功: $success 筆，失敗: $fail 筆");
saveProgress('完成', $success, $total, $log);
echo json_encode(["status"=>"完成","log"=>$log,"success"=>$success,"total"=>$total]);
exit;

function saveProgress($status, $success, $total, $log) {
    global $progressFile;
    file_put_contents($progressFile, json_encode([
        "status"=>$status,
        "success"=>$success,
        "total"=>$total,
        "log"=>$log
    ], JSON_UNESCAPED_UNICODE));
}
