<?php
header('Content-Type: application/json');
$mysqli = new mysqli('localhost', 'cbs21', '094726@Info', '113_cbs21');
if ($mysqli->connect_errno) {
    http_response_code(500);
    echo json_encode(['error' => $mysqli->connect_error]);
    exit;
}

$action = $_GET['action'] ?? '';
if ($action === 'insert' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    // 假設 $input 有 time, symbol, name, price, changePercent, volume
    $stmt = $mysqli->prepare("INSERT INTO mimi_data (time, symbol, name, price, changePercent, volume) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->bind_param('ssssdd', $input['time'], $input['symbol'], $input['name'], $input['price'], $input['changePercent'], $input['volume']);
    $ok = $stmt->execute();
    echo json_encode(['success' => $ok]);
    $stmt->close();
} elseif ($action === 'query') {
    // 支援 symbol、limit、offset 查詢，預設回傳指定 symbol 的歷史資料
    $symbol = $_GET['symbol'] ?? '';
    $limit = intval($_GET['limit'] ?? 1000);
    $offset = intval($_GET['offset'] ?? 0);
    $where = '';
    $params = [];
    $types = '';
    if ($symbol !== '') {
        $where = 'WHERE symbol = ?';
        $params[] = $symbol;
        $types .= 's';
    }
    $sql = "SELECT * FROM mimi_data $where ORDER BY time ASC LIMIT ? OFFSET ?";
    $params[] = $limit;
    $params[] = $offset;
    $types .= 'ii';
    $stmt = $mysqli->prepare($sql);
    if ($where) {
        $stmt->bind_param($types, ...$params);
    } else {
        $stmt->bind_param('ii', $limit, $offset);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    $rows = [];
    while ($row = $result->fetch_assoc()) $rows[] = $row;
    echo json_encode($rows);
    $stmt->close();
} elseif ($action === 'latest_time') {
    $result = $mysqli->query("SELECT time FROM mimi_data ORDER BY time DESC LIMIT 1");
    $row = $result ? $result->fetch_assoc() : null;
    echo json_encode(['latest_time' => $row ? $row['time'] : null]);
} elseif ($action === 'latest_record') {
    $result = $mysqli->query("SELECT * FROM mimi_data ORDER BY time DESC LIMIT 1");
    $row = $result ? $result->fetch_assoc() : null;
    echo json_encode(['latest_record' => $row]);
} elseif ($action === 'progress') {
    // 回傳目前 mimi_data 筆數與 allStockData.json 總筆數
    $countResult = $mysqli->query("SELECT COUNT(*) as cnt FROM mimi_data");
    $dbCount = $countResult ? intval($countResult->fetch_assoc()['cnt']) : 0;
    $jsonCount = 0;
    if (file_exists('allStockData.json')) {
        $json = file_get_contents('allStockData.json');
        $data = json_decode($json, true);
        if (is_array($data)) $jsonCount = count($data);
    }
    echo json_encode([
        'db_count' => $dbCount,
        'json_count' => $jsonCount,
        'progress' => $jsonCount > 0 ? round($dbCount / $jsonCount * 100, 2) : 0
    ]);
} else {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid action']);
}
$mysqli->close();
?>
