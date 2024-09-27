/**
 * RoarBot is a library for creating bots for the [Meower](https://meower.org)
 * platform. It comes with an easy way to connect to Meower and parse commands.
 *
 * > [!NOTE]
 * > Make sure to always use `await` when possible within commands in order for
 * > potential errors to not make your bot crash.
 *
 * ```ts
 * const bot = new RoarBot();
 * bot.command("greet", {
 *   description: "Greet someone!",
 *   args: [
 *     { name: "whom", type: "string" },
 *     { name: "greeting", type: "full" },
 *   ],
 *   fn: async (reply, [whom, greeting]) => {
 *     await reply(`${greeting || "Hello"}, ${whom}!`);
 *   },
 * });
 * bot.login("BearBot", "········");
 *
 * // @BearBot help
 * // @BearBot greet Josh
 * // @BearBot greet Josh Hello there
 * ```
 *
 * ```ts
 * const bot = new RoarBot();
 * bot.run(
 *   import("./commands/add.ts"),
 *   import("./commands/ping.ts"),
 * );
 * bot.login("BearBot", "········");
 *
 * // ==== ./commands/add.ts ====
 * import type { RoarBot } from "../mod.ts";
 *
 * export default (bot: RoarBot) => {
 *   bot.command("add", {
 *     args: ["number", "number"],
 *     fn: async (reply, [n1, n2]) => {
 *       await reply((n1 + n2).toString());
 *     },
 *   });
 * };
 *
 * // ==== ./commands/ping.ts ====
 * import type { RoarBot } from "../mod.ts";
 *
 * export default (bot: RoarBot) => {
 *   bot.command("ping", {
 *     args: [],
 *     fn: async (reply) => {
 *       await reply("Pong");
 *     },
 *   });
 * };
 * ```
 *
 * @module
 */

import {
  JSR_UPDATE,
  AUTH_PACKET_SCHEMA,
  LOGIN_SCHEMA,
  API_POST_SCHEMA,
  POST_PACKET_SCHEMA,
  UPDATE_POST_PACKET_SCHEMA,
  DELETE_POST_PACKET_SCHEMA,
  UPLOADS_ATTACHMENT_SCHEMA,
  API_USER_SCHEMA,
  type UploadsAttachment,
  type User,
} from "./types.ts";
import {
  type Pattern,
  type ResolvePattern,
  parseArgs,
  stringifyPatternType,
} from "./patterns.ts";
import { RichPost } from "./rich/post.ts";
export type { Post, UploadsAttachment, Attachment, User } from "./types.ts";
export * from "./patterns.ts";
export * from "./rich/post.ts";

const ATTACMHENT_MAX_SIZE = 25 << 20;
const version = "1.6.1";
const logTimeFormat = new Intl.DateTimeFormat("en-US", {
  timeStyle: "medium",
  hour12: false,
});

/**
 * A bot connecting to Meower.
 */
export class RoarBot {
  private _events: { [K in keyof Events]: Events[K][] } = {
    login: [],
    post: [],
    updatePost: [],
    deletePost: [],
  };
  private _commands: Command[] = [];
  private _username?: string;
  private _token?: string;
  private _admins: string[];
  private _banned: string[];
  private _ws?: WebSocket;
  private _messages: Messages;
  private _foundUpdate = false;
  private _loggingLevel: LoggingLevel;

  /**
   * Create a bot.
   * @param options Some options. See {@link RoarBotOptions} for more details.
   */
  constructor(options?: RoarBotOptions) {
    this._admins = options?.admins ?? [];
    this._banned = options?.banned ?? [];
    this._loggingLevel = options?.loggingLevel ?? "base";
    this._messages = {
      noCommand: (command) => `The command ${command} doesn't exist!`,
      helpDescription: "Shows this message.",
      helpOptional: "(optional)",
      helpCommands: "## Commands",
      banned: "You are banned from using this bot.",
      adminLocked:
        "You can't use this command as it is limited to administrators.",
      error: "💥 Something exploded. Check the console for more info!",
      argsMissing: (name) => `Missing ${name}.`,
      argsNotInSet: (string, set) => `${string} has to be one of ${set}.`,
      argNan: (string) => `${string} is not a number.`,
      tooManyArgs: "You have too many arguments.",
      ...options?.messages,
    };
    this._checkForUpdates();
    setInterval(
      () => {
        this._checkForUpdates();
      },
      1000 * 60 * 60,
    );
    /*
    this.on("post", (reply, post) => {
      const split = post.p.split(" ");
      
      if (
        split[0].toLowerCase() === `@${this._username}`.toLowerCase() &&
        split[1] &&
        !this._commands.find((command) => command.name === split[1])
      ) {
        reply(this._messages.noCommand(JSON.stringify(split[1])));
      }
    });
    */
    
    if (!(options?.help ?? true)) {
      return;
    }
    this.command("help", {
      description: "Shows this message.",
      args: [],
      fn: async (reply) => {
        const commands = Object.entries(
          Object.groupBy(this._commands, (command) => command.category),
        )
          .map(
            ([name, commands]) =>
              `### ${name}\n` +
              (commands ?? [])
                .map((command) => {
                  const pattern = command.pattern
                    .map((patternType) =>
                      (
                        typeof patternType === "object" &&
                        !Array.isArray(patternType)
                      ) ?
                        (patternType.optional ? "[" : "<") +
                        (("name" in patternType ?
                          `${patternType.name}: `
                        : "") +
                          stringifyPatternType(patternType.type)) +
                        (patternType.optional ? "]" : ">")
                      : `(${stringifyPatternType(patternType)})`,
                    )
                    .join(" ");
                  return (
                    (command.admin ? "🔒 " : "") +
                    `@${this.username} ${command.name} ${pattern}` +
                    (command.description ? `\n_${command.description}_` : "") +
                    "\n"
                  );
                })
                .join("\n"),
          )
          .join("\n");
        await reply(`${this._messages.helpCommands}\n${commands}`);
      },
    });
  }

  private _log(
    level: "ws" | "info" | "error" | "success",
    msg: string,
    // deno-lint-ignore no-explicit-any -- console.log uses `any[]` as well
    ...other: any[]
  ) {
    if (
      this._loggingLevel !== "none" &&
      !(level === "ws" && this._loggingLevel !== "ws")
    ) {
      console.log(
        `\x1b[1;90m[${logTimeFormat.format(Date.now())}]\x1b[1;0m`,
        (level === "info" || level === "ws" ? "\x1b[1;90m"
        : level === "error" ? "\x1b[1;31m"
        : "\x1b[1;36m") + msg,
        ...other,
        "\x1b[0m",
      );
    }
  }

  private async _checkForUpdates() {
    if (this._foundUpdate) {
      return;
    }
    this._log("info", "Checking for RoarBot updates...");
    try {
      const response = JSR_UPDATE.parse(
        await (await fetch("https://jsr.io/@mbw/roarbot/meta.json")).json(),
      );
      if (version !== response.latest) {
        console.log(
          `A new RoarBot version is available! ${version} → ${response.latest}\nSee the changelog for the changes: https://github.com/mybearworld/roarbot/blob/main/CHANGELOG.md`,
        );
      }
      this._foundUpdate = true;
    } catch {
      this._log(
        "error",
        "Failed to check for RoarBot updates. Ensure that you're on a recent version!",
      );
    }
  }

  /**
   * Log into an account and start the bot.
   * @param username The username of the account the bot should log into.
   * @param password The password of the account the bot should log into. This can also be a token that will get invalidated when the login succeeds.
   * @throws When the login fails.
   * @throws When the bot is already logged in.
   * @example
   * ```js
   * const bot = new RoarBot();
   * bot.login("BearBot", "12345678");
   * ```
   * > [!NOTE]
   * > In a real scenario, the password should not be in plain text like this,
   * > but in an environment variable.
   */
  async login(username: string, password: string) {
    this._log("info", `Trying to log into ${username}...`);
    if (this._token) {
      throw new Error("This bot is already logged in.");
    }
    const response = LOGIN_SCHEMA.parse(
      await (
        await fetch(`https://api.meower.org/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        })
      ).json(),
    );
    if (response.error) {
      throw new Error(
        `Couldn't log in: ${response.type}. Ensure that you have the correct password!`,
      );
    }
    this._log("success", "Recieved initial token.");
    this._log("info", "Connecting to Meower...");
    const ws = new WebSocket(
      `https://server.meower.org?v=1&token=${response.token}`,
    );
    this._ws = ws;
    ws.addEventListener("message", ({ data }) => {
      this._log("ws", data);
    });
    ws.addEventListener("message", ({ data }) => {
      const parsed = AUTH_PACKET_SCHEMA.safeParse(JSON.parse(data));
      if (!parsed.success) {
        return;
      }
      const token = parsed.data.val.token;
      this._log("success", "Recieved token. Logged in successfully!");
      this._username = username;
      this._token = token;
      this._events.login.forEach((callback) => callback(token));
    });
    ws.addEventListener("message", ({ data }) => {
      const parsed = POST_PACKET_SCHEMA.safeParse(JSON.parse(data));
      if (!parsed.success) {
        return;
      }
      this._events.post.forEach((callback) => {
        const post = new RichPost(parsed.data.val, this);
        callback(post.reply.bind(post), post);
      });
    });
    ws.addEventListener("message", ({ data }) => {
      const parsed = UPDATE_POST_PACKET_SCHEMA.safeParse(JSON.parse(data));
      if (!parsed.success) {
        return;
      }
      this._events.updatePost.forEach((callback) => {
        const post = new RichPost(parsed.data.val, this);
        callback(post.reply.bind(post), post);
      });
    });
    ws.addEventListener("message", ({ data }) => {
      const parsed = DELETE_POST_PACKET_SCHEMA.safeParse(JSON.parse(data));
      if (!parsed.success) {
        return;
      }
      this._events.deletePost.forEach((callback) =>
        callback(parsed.data.val.post_id),
      );
    });
    ws.addEventListener("close", (ev) => {
      this._log("error", "Connection closed.", ev);
    });
  }

  /**
   * Listen to an event that occurs.
   * @param event The event to listen for.
   * @param callback The callback to execute when the event fires.
   * @example
   * ```ts
   * bot.on("login", () => console.log("Hooray!"));
   * ```
   */
  on<TEvent extends keyof Events>(event: TEvent, callback: Events[TEvent]) {
    this._events[event].push(callback);
  }

  /**
   * Create a new post.
   * @param content The content of the post.
   * @param options More parameters of the post. See {@link PostOptions} for
   * details.
   * @throws If the bot is not logged in.
   * @throws If the API returns an error.
   * @throws If {@link RoarBot.prototype.uploadFile} fails.
   * @returns The resulting post. This might be returned later than the post
   * will be appearing via the socket.
   */
  async post(content: string, options?: PostOptions): Promise<RichPost> {
    if (!this._token) {
      throw new Error("The bot is not logged in.");
    }
    const response = API_POST_SCHEMA.parse(
      await (
        await fetch(
          `https://api.meower.org/${
            !options?.chat || options?.chat === "home" ?
              "home"
            : `posts/${options?.chat}`
          }`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Token: this._token,
            },
            body: JSON.stringify({
              content,
              reply_to: options?.replies,
              attachments: await Promise.all(
                (options?.attachments ?? []).map((attachment) =>
                  typeof attachment === "string" ? attachment : (
                    this.upload(attachment).then((attachment) => attachment.id)
                  ),
                ),
              ),
            }),
          },
        )
      ).json(),
    );
    if (response.error) {
      throw new Error(`Couldn't post: ${response.type}`);
    }
    return new RichPost(response, this);
  }

  /**
   * Get the profile of a user.
   * @param username The username to get the profile of.
   * @returns The user profile.
   * @throws If the API returns an error.
   */
  async user(username: string): Promise<User> {
    const response = API_USER_SCHEMA.parse(
      await (
        await fetch(
          `https://api.meower.org/users/${encodeURIComponent(username)}`,
        )
      ).json(),
    );
    if (response.error) {
      throw new Error(`Couldn't get user. Error: ${response.type}`);
    }
    return response;
  }

  /**
   * Upload an attachment to Meower for use in posts.
   * @param file The file to upload.
   * @returns The uploaded file returned from the API.
   * @throws If the bot is not logged in.
   * @throws If the file is too large.
   * @throws If the API returns an error.
   */
  async upload(file: Blob): Promise<UploadsAttachment> {
    if (!this._token) {
      throw new Error("The bot is not logged in.");
    }
    if (file.size > ATTACMHENT_MAX_SIZE) {
      throw new Error(
        `The file is too large. Keep it at or under ${ATTACMHENT_MAX_SIZE}B`,
      );
    }
    const form = new FormData();
    form.set("file", file);
    const response = UPLOADS_ATTACHMENT_SCHEMA.parse(
      await (
        await fetch("https://uploads.meower.org/attachments", {
          method: "POST",
          body: form,
          headers: { Authorization: this._token },
        })
      ).json(),
    );
    return response;
  }

  /**
   * Sets the account settings of the account.
   * @param options The options to set.
   * @throws If the bot is not logged in.
   * @throws If the API returns an error.
   */
  async setAccountSettings(options: SetAccountSettingsOptions) {
    if (!this._token) {
      throw new Error("The bot is not logged in.");
    }
    const response = await fetch("https://api.meower.org/me/config", {
      method: "PATCH",
      headers: {
        Token: this._token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...options,
        avatar_color: options.avatarColor,
        unread_inbox: options.unreadInbox,
        hide_blocked_users: options.hideBlockedUsers,
        favorited_chats: options.favoritedChats,
      }),
    });
    if (response.ok) {
      return;
    }
    throw new Error(
      `Failed to set account settings. The server responded with ${response.status}`,
    );
  }

  /**
   * Register a new command.
   * @param name The name of the command.
   * @param options Some options. See {@link CommandOptions} for details.
   * @throws If a command with that name is already present.
   */
  command<const TPattern extends Pattern>(
    name: string,
    options: CommandOptions<TPattern>,
  ) {
    if (this._commands.some((command) => command.name === name)) {
      throw new Error(
        `A command with the name of ${JSON.stringify(name)} already exists.`,
      );
    }
    this._commands.push({
      name: name,
      description: options.description ?? null,
      category: options.category ?? "None",
      pattern: options.args,
      admin: options.admin ?? false,
    });
    this._log("success", `Registered command ${JSON.stringify(name)}.`);
    this.on("post", async (reply, post) => {
      if (post.username === this.username) {
        //return;
      }
      const split = post.content.split(" ");
      if (
        split[0].toLowerCase() !== `@${this.username}`.toLowerCase() ||
        split[1] !== name
      ) {
        return;
      }
      const commandName = `${JSON.stringify(post.content)} by ${post.username} in ${post.origin}`;
      this._log("info", `Running ${commandName}...`);
      const handleError = async (fn: () => void | Promise<void>) => {
        try {
          await fn();
        } catch (e) {
          this._log(
            "error",
            `Couldn't run ${commandName} because an error occured.`,
            e,
          );
          try {
            await reply(this._messages.error);
          } catch (f) {
            this._log(
              "error",
              "Another error occured trying to send the error.",
              f,
            );
          }
        }
      };
      let refuse = false;
      await handleError(async () => {
        if (this._banned.includes(post.username)) {
          this._log(
            "error",
            `Refused running ${commandName} as the user is banned.`,
          );
          refuse = true;
          await reply(this._messages.banned);
        }
      });
      if (refuse) {
        return;
      }
      await handleError(async () => {
        if (options.admin && !this._admins.includes(post.username)) {
          this._log(
            "error",
            `Refused running ${commandName} as the user is not an admin.`,
          );
          refuse = true;
          await reply(this._messages.adminLocked);
        }
      });
      if (refuse) {
        return;
      }
      const parsed = parseArgs(options.args, split.slice(2), this._messages);
      await handleError(async () => {
        if (parsed.error) {
          this._log(
            "error",
            `Couldn't run ${commandName} because ${parsed.message}`,
          );
          await reply(parsed.message);
        } else {
          await options.fn(reply, parsed.parsed, post);
          this._log("success", `Successfully ran ${commandName}.`);
        }
      });
    });
  }

  /**
   * Passes the bot to different modules. This should be used to separate
   * different bits of functionality, like commands, into different files.
   * @param modules An array of dynamically imported modules with a default
   * export that gets in the bot.
   *
   * @example
   * ```ts
   * const bot = new RoarBot();
   * bot.run(
   *   import("./commands/add.ts"),
   *   import("./commands/ping.ts"),
   * );
   * bot.login("BearBot", "········");
   *
   * // ==== ./commands/add.ts ====
   * import type { RoarBot } from "../mod.ts";
   *
   * export default (bot: RoarBot) => {
   *   bot.command("add", {
   *     args: ["number", "number"],
   *     fn: async (reply, [n1, n2]) => {
   *       await reply((n1 + n2).toString());
   *     },
   *   });
   * };
   *
   * // ==== ./commands/ping.ts ====
   * import type { RoarBot } from "../mod.ts";
   *
   * export default (bot: RoarBot) => {
   *   bot.command("ping", {
   *     args: [],
   *     fn: async (reply) => {
   *       await reply("Pong");
   *     },
   *   });
   * };
   * ```
   */
  async run(...modules: Promise<{ default: (bot: RoarBot) => void }>[]) {
    const awaitedModules = await Promise.all(modules);
    awaitedModules.forEach((module) => module.default(this));
  }

  /**
   * The username of the account the bot is logged into. If the bot isn't logged
   * in, this is `undefined`.
   */
  get username(): string | undefined {
    return this._username;
  }

  /**
   * The token of the account the bot is logged into. If the bot isn't logged
   * in, this is `undefined`.
   */
  get token(): string | undefined {
    return this._token;
  }

  /** The used commands. */
  get commands(): Command[] {
    return [...this._commands];
  }

  /**
   * The open WebSocket connection. This is `undefined` if the bot is not
   * logged in.
   */
  get ws(): WebSocket | undefined {
    return this._ws;
  }
}

/**
 * A mapping of events to their respective callbacks.
 */
export type Events = {
  login: (token: string) => void;
  post: (reply: RichPost["reply"], post: RichPost) => void;
  updatePost: (reply: RichPost["reply"], post: RichPost) => void;
  deletePost: (id: string) => void;
};

/** Options that can be passed into {@link RoarBot}. */
export type RoarBotOptions = {
  /** The administrators of this bot. They can use admin commands. */
  admins?: string[];
  /**
   * Users banned from using the bot. Any commands they try to run won't be executed.
   */
  banned?: string[];
  /**
   * Whether to have a generated help command. By default, this is true.
   */
  help?: boolean;
  /**
   * Different messages the bot might send. Each of them has a default that
   * will be used if none are provided here.
   */
  messages?: Partial<Messages>;
  /** Whether to log messages to the console. */
  loggingLevel?: LoggingLevel;
};

/**
 * How much logging the bot should do. By default, this is `"base"`.
 * - `none`: No logging at all
 * - `base`: Logging of most things.
 * - `ws`: Same as `base`, but also logs packets from the server.
 */
export type LoggingLevel = "none" | "base" | "ws";

/**
 * Different messgaes the bot might send. Each of them has a default that will
 * be used if none are provided here.
 */
export type Messages = {
  /** When a command doesn't exist. */
  noCommand: (command: string) => string;
  /** Description of the help command. */
  helpDescription: string;
  /** @deprecated Unused */
  helpOptional: string;
  /** Heading for the commands in the help command. */
  helpCommands: string;
  /** Message for when a user is banned. */
  banned: string;
  /** Message for when someone tries to run an admin-locked command. */
  adminLocked: string;
  /** Message for when something goes wrong. */
  error: string;
  /** Message for when an argument is missing. */
  argsMissing: (name: string) => string;
  /** Message for when a string is not in the expected set of strings. */
  argsNotInSet: (string: string, set: string) => string;
  /** Message for when something is not a number. */
  argNan: (string: string) => string;
  /** Message for when there are too many arguments. */
  tooManyArgs: string;
};

/**
 * Options that can be passed into {@link RoarBot.prototype.command}.
 */
export type CommandOptions<TPattern extends Pattern> = {
  /** The description of the command. This is shown in the help message. */
  description?: string;
  /** The category the command is in. This is shown in the help message. */
  category?: string;
  /** The argument pattern of the command. */
  args: TPattern;
  /** Whether this command is only usable by administrators. */
  admin?: boolean;
  /** The callback to be called when the command gets executed. */
  fn: (
    reply: RichPost["reply"],
    args: ResolvePattern<TPattern>,
    post: RichPost,
  ) => void | Promise<void>;
};

/** A command when it has been added to a bot. */
export type Command = {
  /** The name of the command. */
  name: string;
  /** The category of the command. */
  category: string;
  /** The description of the command. */
  description: string | null;
  /** The pattern the arguments use. */
  pattern: Pattern;
  /** Whether the command is limited to administrators. */
  admin: boolean;
};

/**
 * Options that can be passed into {@link RoarBot.prototype.post}.
 */
export type PostOptions = {
  /** Post IDs that this post is replying to. */
  replies?: string[];
  /**
   * The attachments to upload with a post. These can either be attachment IDs
   * or blobs that are passed to {@link RoarBot.prototype.upload}
   */
  attachments?: (string | Blob)[];
  /**
   * The chat to post to. If this is not specified, the post will be posted to
   * home. The available special chats are:
   * - `home`
   * - `livechat`
   */
  chat?: string;
};

/**
 * Options that can be passed into {@link RoarBot.prototype.setAccountSettings}
 * to modify.
 */
export type SetAccountSettingsOptions = {
  /** A default profile picture. */
  pfp?: number;
  /** An uploaded profile picture. TODO: Make uploading icons possible */
  avatar?: string;
  /** The profile color. */
  avatarColor?: string;
  /** The quote. */
  quote?: string;
  /** Whether the account has unread messages in their inbox. */
  unreadInbox?: boolean;
  /** The theme the account uses on Meower Svelte. */
  theme?: string;
  /** The layout the account uses on Meower Svelte. */
  layout?: string;
  /** Whether the account has sound effects enabled on Meower Svelte. */
  sfx?: boolean;
  /** Whether the account has background music enabled on Meower Svelte. */
  bgm?: boolean;
  /** The song the account uses as background music on Meower Svelte. */
  bgmSong?: number;
  /** Whether the account has debug mode enabled on Meower Svelte. */
  debug?: boolean;
  /**
   * Whether the account is not recieving posts from blocked users.
   * > [!NOTE]
   * > For this to take effect, the account has to log in again.
   */
  hideBlockedUsers?: boolean;
  /** The chats the user has favorited. */
  favoritedChats?: string[];
};
