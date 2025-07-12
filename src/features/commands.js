const { Todo } = require("./todo");
const { Help } = require("./help");
const { Report } = require("./report");
const { Keyword } = require("./keyword");

async function handleReportCommand(message) {
  Report(message);
}

async function handleKeywordCommand(message) {
  Keyword(message);
}

async function handleTodoCommand(message) {
  Todo(message);
}

async function handleHelpCommand(message) {
  Help(message);
}

module.exports = {
  handleReportCommand,
  handleKeywordCommand,
  handleHelpCommand,
  handleTodoCommand,
};
