<?php
// 匯入 allStockData.json 到 mimi_data 資料表
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="zh-Hant" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <title>資料匯入進度</title>
  <link href="https://cdn.jsdelivr.net/npm/daisyui@4.10.2/dist/full.css" rel="stylesheet" type="text/css" />
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-base-200 min-h-screen flex flex-col items-center justify-center">
<div class="w-full max-w-2xl mt-10">
<div class="card bg-base-100 shadow-xl">
<div class="card-body">
<h2 class="card-title text-primary">資料匯入進度</h2>
<div id="progress-bar" class="w-full bg-base-200 rounded h-6 mb-2">
  <div id="progress-inner" class="bg-success h-6 rounded" style="width:0%"></div>
</div>
<div class="flex justify-between text-xs mb-2">
  <span id="progress-text">尚未開始</span>
  <span id="progress-count"></span>
</div>
<pre id="log" class="bg-base-200 rounded p-4 text-success text-sm" style="min-height:120px;max-height:300px;overflow:auto;"></pre>
<div class="mt-4 flex gap-2">
  <button id="start-btn" class="btn btn-primary">開始匯入</button>
  <button id="refresh-btn" class="btn btn-outline btn-secondary">重新整理</button>
  <a href="progress.html" class="btn btn-success">查看同步進度 Dashboard</a>
</div>
</div>
</div>
</div>
<script>
const startBtn = document.getElementById('start-btn');
const refreshBtn = document.getElementById('refresh-btn');
const logEl = document.getElementById('log');
const progressBar = document.getElementById('progress-inner');
const progressText = document.getElementById('progress-text');
const progressCount = document.getElementById('progress-count');
let polling = false;

function fetchProgress() {
  fetch('import-api.php?action=progress')
    .then(r => r.json())
    .then(data => {
      logEl.innerHTML = (data.log || []).join('\n');
      let percent = data.total ? Math.round(data.success / data.total * 100) : 0;
      progressBar.style.width = percent + '%';
      progressText.textContent = data.status || '';
      progressCount.textContent = `${data.success || 0} / ${data.total || 0}`;
      if (data.status === '完成' || data.status === '無需匯入新資料') {
        polling = false;
        startBtn.disabled = false;
      }
    });
}

function poll() {
  if (!polling) return;
  fetchProgress();
  setTimeout(poll, 1000);
}

startBtn.onclick = () => {
  startBtn.disabled = true;
  logEl.textContent = '啟動匯入...';
  fetch('import-api.php?action=start', {method:'POST'})
    .then(r => r.json())
    .then(data => {
      polling = true;
      poll();
    });
};
refreshBtn.onclick = () => {
  fetchProgress();
};
// 頁面載入時自動查詢進度
fetchProgress();
</script>
</body>
</html>
