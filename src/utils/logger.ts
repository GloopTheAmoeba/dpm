export class Logger {
  private static redactSecrets(message: string): string {
    let redacted = message;
    // Redact tokens, passwords, secrets if present in strings
    const secretsToRedact = [
      process.env.DISCORD_BOT_TOKEN,
      process.env.TELEGRAM_BOT_TOKEN,
      process.env.TELEGRAM_WEBHOOK_SECRET,
      process.env.DATABASE_URL,
    ].filter(Boolean) as string[];

    for (const secret of secretsToRedact) {
      if (secret && secret.length > 3) {
        redacted = redacted.replaceAll(secret, '[REDACTED]');
      }
    }
    return redacted;
  }

  static info(message: string, ...args: unknown[]) {
    console.log(`[INFO] ${this.redactSecrets(message)}`, ...args.map((a) => typeof a === 'string' ? this.redactSecrets(a) : a));
  }

  static warn(message: string, ...args: unknown[]) {
    console.warn(`[WARN] ${this.redactSecrets(message)}`, ...args.map((a) => typeof a === 'string' ? this.redactSecrets(a) : a));
  }

  static error(message: string, ...args: unknown[]) {
    console.error(`[ERROR] ${this.redactSecrets(message)}`, ...args.map((a) => typeof a === 'string' ? this.redactSecrets(a) : a));
  }
}
