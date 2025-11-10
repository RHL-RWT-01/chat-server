import config from './config.js';
import { Command } from './types.js';

export class CommandParser {
  /**
   * Parse incoming command from client
   */
  public static parse(data: string): Command {
    const trimmed = data.trim();

    if (!trimmed) {
      return { type: 'UNKNOWN', args: [], raw: trimmed };
    }

    // Split on first space to get command and rest
    const firstSpace = trimmed.indexOf(' ');

    if (firstSpace === -1) {
      // Single word command (e.g., "WHO")
      const cmd = trimmed.toUpperCase();
      return {
        type: cmd === 'WHO' ? 'WHO' : 'UNKNOWN',
        args: [],
        raw: trimmed,
      };
    }

    const command = trimmed.substring(0, firstSpace).toUpperCase();
    const rest = trimmed.substring(firstSpace + 1).trim();

    switch (command) {
      case 'LOGIN':
        return {
          type: 'LOGIN',
          args: [rest],
          raw: trimmed,
        };

      case 'MSG':
        return {
          type: 'MSG',
          args: [rest],
          raw: trimmed,
        };

      case 'DM': {
        // DM <username> <text>
        const dmSpace = rest.indexOf(' ');
        if (dmSpace === -1) {
          return { type: 'UNKNOWN', args: [], raw: trimmed };
        }
        const targetUsername = rest.substring(0, dmSpace);
        const message = rest.substring(dmSpace + 1).trim();
        return {
          type: 'DM',
          args: [targetUsername, message],
          raw: trimmed,
        };
      }

      default:
        return { type: 'UNKNOWN', args: [], raw: trimmed };
    }
  }

  /**
   * Validate username
   */
  public static isValidUsername(username: string): boolean {
    if (!username || username.length === 0) {
      return false;
    }

    if (username.length > config.usernameMaxLength) {
      return false;
    }

    // Username should only contain alphanumeric, underscore, and hyphen
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    return usernameRegex.test(username);
  }

  /**
   * Validate message
   */
  public static isValidMessage(message: string): boolean {
    if (!message || message.trim().length === 0) {
      return false;
    }

    if (message.length > config.messageMaxLength) {
      return false;
    }

    return true;
  }

  /**
   * Sanitize message to prevent control characters
   */
  public static sanitizeMessage(message: string): string {
    // Remove control characters except newlines and tabs
    return message.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  }
}
