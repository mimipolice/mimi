const { Client } = require("discord.js-selfbot-v13");
require("dotenv").config(); // Load environment variables from .env file

const client = new Client();

client.on("ready", async () => {
  client.user.setSamsungActivity("com.miHoYo.bh3oversea", "START");
});

client.login(process.env.TOKEN);
