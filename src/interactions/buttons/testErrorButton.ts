import {
  ButtonInteraction,
  Client,
} from "discord.js";
import { Button } from "../../interfaces/Button";
import { BusinessError } from "../../errors";

const button: Button = {
  name: "test_error",
  execute: async (interaction: ButtonInteraction, client: Client, services: any) => {
    // Simulate different types of errors based on button customId
    const [, errorType] = interaction.customId.split(":");
    
    switch (errorType) {
      case "business":
        throw new BusinessError("這是一個測試業務邏輯錯誤訊息");
      
      case "internal":
        throw new Error("這是一個測試內部錯誤");
      
      case "cooldown":
        const { CooldownError } = await import("../../errors");
        throw new CooldownError(5.5);
      
      case "permissions":
        const { MissingPermissionsError } = await import("../../errors");
        throw new MissingPermissionsError("你沒有權限執行此操作");
      
      default:
        throw new BusinessError("未知的錯誤類型");
    }
  },
};

export default button;
