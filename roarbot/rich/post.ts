// yes its a mess
// yes this is because of typescript
// yes i want to do something about it but i cant
// - mbw

import type { Post, PostOptions, RoarBot } from "../mod.ts";
import type { Attachment } from "../types.ts";

export class RichPost implements Post {
  private _events: { [K in keyof RichPostEvents]: RichPostEvents[K][] } = {
    update: [],
    delete: [],
  };
  /** The attachments the post has. */
  attachments!: Attachment[];
  /**
   * @deprecated Only included for backwards compatibility. Use
   * {@link RichPost.prototype.editedAt} instead.
   */
  edited_at?: number;
  /** Whether the post is deleted or not. */
  isDeleted!: boolean;
  /**
   * @deprecated Only included for backwards compatibility. Use
   * {@link RichPost.prototype.content} instead.
   */
  p!: string;
  /**
   * @deprecated Only included for backwards compatibility. Use
   * {@link RichPost.prototype.id} instead.
   */
  post_id!: string;
  /**
   * @deprecated Only included for backwards compatibility. Use
   * {@link RichPost.prototype.origin} instead.
   */
  post_origin!: string;
  /**
   * @deprecated Only included for backwards compatibility. Use
   * {@link RichPost.prototype.createdAt} instead.
   */
  t!: { e: number };
  /**
   * @deprecated Only included for backwards compatibility. Check for whether
   * {@link RichPost.prototype.origin} is `inbox` instead.
   */
  type!: number;
  /**
   * @deprecated Only included for backwards compatibility. Use
   * {@link RichPost.prototype.username} instead.
   */
  u!: string;
  /** The reactions the post got. */
  reactions!: {
    /** The amount of times this emoji was reacted. */
    count: number;
    /** The emoji that was reacted with. */
    emoji: string;
    /** Whether the current user reacted to the post. */
    userReacted: boolean;
    /**
     * @deprecated Only include for backwards compatibility. Use userReacted
     * instead.
     */
    user_reacted: boolean;
  }[];
  /**
   * @deprecated Only included for backwards compatibility. Use
   * {@link RichBot.prototype.replyTo} instead.
   */
  reply_to!: (RichPost | null)[];
  private _bot: RoarBot;

  constructor(post: Post, bot: RoarBot) {
    this._bot = bot;
    this._applyPost(post);
    this._bot.on("updatePost", (_reply, post) => {
      if (post.id === this.id) {
        this._applyPost(post);
        this._events.update.forEach((callback) => callback());
      }
    });
    this._bot.on("deletePost", (id) => {
      if (id === this.id) {
        this.isDeleted = true;
        this._events.delete.forEach((callback) => callback());
      }
    });
  }

  private _applyPost(post: Post) {
    this.attachments = post.attachments;
    this.edited_at = post.edited_at;
    this.isDeleted = post.isDeleted;
    this.p = post.p;
    this.post_id = post.post_id;
    this.post_origin = post.post_origin;
    this.t = post.t;
    this.type = post.type;
    this.u = post.u;
    this.reactions = post.reactions.map((reaction) => ({
      ...reaction,
      userReacted: reaction.user_reacted,
    }));
    this.reply_to = post.reply_to.map((post) =>
      !post ? post : new RichPost(post, this._bot),
    );
  }

  /**
   * When the post was edited. if it hasn't been, this is `undefined`.
   */
  get editedAt(): Date | undefined {
    return this.edited_at ? new Date(this.edited_at * 1000) : undefined;
  }
  /** The contnet of the post. */
  get content(): string {
    return this.p;
  }
  /** The ID of the post. */
  get id(): string {
    return this.post_id;
  }
  /**
   * In which chat the post has been made. This can be an ID or the special
   * chats `"home"`, `"livechat"` or `"inbox"`.
   */
  get origin(): string {
    return this.post_origin;
  }
  /** When the post was created. */
  get createdAt(): Date {
    return new Date(this.t.e * 1000);
  }
  /** The username of the user who created the post. */
  get username(): string {
    return this.u;
  }
  /**
   * Which posts the post replied to. `null` indicates a deleted post or a left
   * out nested post.
   */
  get replyTo(): (RichPost | null)[] {
    return this.reply_to;
  }

  /**
   * Listen to an event that occurs.
   * @param event The event to listen for.
   * @param callback The callback to execute when the event fires.
   * @example
   * ```ts
   * post.on("update", () => console.log(post.content));
   * ```
   */
  on<TEvent extends keyof RichPostEvents>(
    event: TEvent,
    callback: RichPostEvents[TEvent],
  ) {
    this._events[event].push(callback);
  }

  /**
   * Deletes this post.
   * @throws If the bot isn't logged in.
   * @throws If the post isn't owned by the bot.
   * @throws If the API returns an error.
   */
  async delete() {
    if (!this._bot.token) {
      throw new Error("The bot is not logged in.");
    }
    if (this._bot.username?.toLowerCase() !== this.username.toLowerCase()) {
      throw new Error("This post is not made by the bot.");
    }
    const response = await fetch(`https://api.meower.org/posts?id=${this.id}`, {
      method: "DELETE",
      headers: { Token: this._bot.token },
    });
    if (!response.ok) {
      throw new Error(
        `Couldn't delete post. The API returned ${response.status}`,
      );
    }
  }

  /**
   * Replies to this post.
   * @param content The content of the reply.
   * @param options More parameters of the post. See {@link PostOptions} for
   * details. Note that you cannot specify `replies` or `chat`.
   * @returns The new reply.
   * @throws When {@link RoarBot.prototype.post} throws.
   */
  reply(
    content: string,
    options?: Omit<PostOptions, "replies" | "chat">,
  ): Promise<RichPost> {
    return this._bot.post(content, {
      replies: [this.id],
      chat: this.origin,
      ...options,
    });
  }
}
/**
 * A mapping of `RichPosts` event to their respective callbacks.
 */
export type RichPostEvents = {
  update: () => void;
  delete: () => void;
};
