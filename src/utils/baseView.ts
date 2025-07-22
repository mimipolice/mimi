import {
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  Interaction,
  Client,
} from "discord.js";

export abstract class BaseView extends ActionRowBuilder<
  ButtonBuilder | StringSelectMenuBuilder
> {
  constructor(protected client: Client, protected userId: string) {
    super();
  }

  async on_error(error: Error, interaction: Interaction): Promise<void> {
    (this.client as any).logger.debug(
      `Error in view ${this.constructor.name}: ${error.message}`,
      error.stack
    );
  }
}
