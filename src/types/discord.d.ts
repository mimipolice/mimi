import { Collection } from 'discord.js';
import { Command } from '../interfaces/Command';
import { Button } from '../interfaces/Button';
import { Modal } from '../interfaces/Modal';
import { SelectMenu } from '../interfaces/SelectMenu';

declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, Command>;
    buttons: Collection<string, Button>;
    modals: Collection<string, Modal>;
    selectMenus: Collection<string, SelectMenu>;
  }
}
