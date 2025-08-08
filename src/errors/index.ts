export class BusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessError";
  }
}

export class InsufficientBalanceError extends BusinessError {
  public required: number;
  public current: number;

  constructor(message: string, required: number, current: number) {
    super(message);
    this.name = "InsufficientBalanceError";
    this.required = required;
    this.current = current;
  }
}

export class CooldownError extends Error {
  public retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = "CooldownError";
    this.retryAfter = retryAfter;
  }
}

export class CustomCheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomCheckError";
  }
}

export class MissingPermissionsError extends Error {
  constructor(message: string = "User is missing necessary permissions.") {
    super(message);
    this.name = "MissingPermissionsError";
  }
}
