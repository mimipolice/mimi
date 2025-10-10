import { Client, Events, ActivityType } from "discord.js";
import logger from "../utils/logger";

const getActivities = (client: Client) => [
  { name: "米米><", type: ActivityType.Custom },
  {
    name: ` ${client.guilds.cache.size} servers`,
    type: ActivityType.Watching,
  },
];

let currentIndex = 0;

export default {
  name: Events.ClientReady,
  once: true,
  execute(client: Client) {
    logger.info(`Ready! Logged in as ${client.user?.tag}`);

    setInterval(() => {
      const activities = getActivities(client);
      const activity = activities[currentIndex];
      client.user?.setActivity(activity.name, { type: activity.type });
      currentIndex = (currentIndex + 1) % activities.length;
    }, 15000); // 15 seconds
  },
};
