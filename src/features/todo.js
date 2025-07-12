const fs = require("fs");
const path = require("path");

const todosPath = path.resolve(__dirname, "../../data/json/todos.json");

function loadTodos() {
  if (!fs.existsSync(todosPath)) return [];
  return JSON.parse(fs.readFileSync(todosPath, "utf8"));
}

function saveTodos(todos) {
  fs.writeFileSync(todosPath, JSON.stringify(todos, null, 2));
}

async function Todo(message) {
  const content = message.content.trim();
  if (content.startsWith("&td add ")) {
    const match = content.match(/^&td add (.+)/);
    if (!match) {
      message.reply("format error，請用 &td add <事情>");
      return;
    }
    const [, task] = match;
    const todos = loadTodos();
    todos.push({ text: task, done: false });
    saveTodos(todos);
    message.reply(`已新增待辦事項：${task}\n-# by <@${message.author.id}>`);
    return;
  }
  if (content.startsWith("&td rm ")) {
    const match = content.match(/^&td rm (\d+)/);
    if (!match) {
      message.reply("format error，請用 &td rm <編號>");
      return;
    }
    const [, idxStr] = match;
    const idx = parseInt(idxStr, 10) - 1;
    const todos = loadTodos();
    if (idx < 0 || idx >= todos.length) {
      message.reply("無此編號");
      return;
    }
    todos[idx].done = true;
    saveTodos(todos);
    message.reply(
      `已標記完成：~~${todos[idx].text}~~\n-# by <@${message.author.id}>`
    );
    return;
  }
  if (content === "&td list") {
    const todos = loadTodos();
    if (todos.length === 0) {
      const reply = await message.reply("目前沒有待辦事項");
      setTimeout(() => {
        reply.delete().catch(() => {});
      }, 3000);
      return;
    }
    let msg = "**待辦清單：**\n";
    todos.forEach((t, i) => {
      msg += `${i + 1}. ${t.done ? `~~${t.text}~~` : t.text}\n`;
    });
    message.reply(msg);
    return;
  }
  if (content === "&td clear") {
    saveTodos([]);
    const reply = await message.reply(
      `已清空所有待辦事項！\n-# by <@${message.author.id}>`
    );
    setTimeout(() => {
      reply.delete().catch(() => {});
    }, 3000);
    return;
  }
}

module.exports = {
  Todo,
};
