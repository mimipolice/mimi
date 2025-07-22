import { ModalBuilder, Interaction, Client } from "discord.js";

export abstract class BaseModal extends ModalBuilder {
  constructor(protected client: Client) {
    super();
  }

  async on_error(error: Error, interaction: Interaction): Promise<void> {
    (this.client as any).logger.debug(
      `Error in modal ${this.constructor.name}: ${error.message}`,
      error.stack
    );
  }
}
