import { z } from "npm:zod@3";

export const JSR_UPDATE = z.object({
  latest: z.string(),
});

export const LOGIN_SCHEMA = z.discriminatedUnion("error", [
  z.object({ error: z.literal(false), token: z.string() }),
  z.object({ error: z.literal(true), type: z.string() }),
]);
export const AUTH_PACKET_SCHEMA = z.object({
  cmd: z.literal("auth"),
  val: z.object({ token: z.string() }),
});

/** An attachement as in {@link Post}. */
export type Attachment = {
  filename: string;
  height: number;
  id: string;
  mime: string;
  size: number;
  width: number;
};
export const ATTACHMENT_SCHEMA: z.ZodType<Attachment> = z.object({
  filename: z.string(),
  height: z.number(),
  id: z.string(),
  mime: z.string(),
  size: z.number(),
  width: z.number(),
});

/** A post returned from the Meower API. */
export type Post = {
  attachments: Attachment[];
  edited_at?: number;
  isDeleted: boolean;
  p: string;
  post_id: string;
  post_origin: string;
  t: { e: number };
  type: number;
  u: string;
  reactions: { count: number; emoji: string; user_reacted: boolean }[];
  reply_to: (Post | null)[];
};
export const BASE_POST_SCHEMA = z.object({
  attachments: ATTACHMENT_SCHEMA.array(),
  edited_at: z.number().optional(),
  isDeleted: z.literal(false),
  p: z.string(),
  post_id: z.string(),
  post_origin: z.string(),
  t: z.object({ e: z.number() }),
  type: z.number(),
  u: z.string(),
  reactions: z
    .object({
      count: z.number(),
      emoji: z.string(),
      user_reacted: z.boolean(),
    })
    .array(),
});
const POST_SCHEMA: z.ZodType<Post> = BASE_POST_SCHEMA.extend({
  reply_to: z.lazy(() => POST_SCHEMA.nullable().array()),
});

export const API_POST_SCHEMA = z
  .object({ error: z.literal(false) })
  .and(POST_SCHEMA)
  .or(z.object({ error: z.literal(true), type: z.string() }));

export const POST_PACKET_SCHEMA = z.object({
  cmd: z.literal("post"),
  val: POST_SCHEMA,
});

export const UPDATE_POST_PACKET_SCHEMA = z.object({
  cmd: z.literal("update_post"),
  val: POST_SCHEMA,
});
export const DELETE_POST_PACKET_SCHEMA = z.object({
  cmd: z.literal("delete_post"),
  val: z.object({
    post_id: z.string()
  }),
});

/** An attachment as returned from the uploading API. */
export type UploadsAttachment = {
  bucket: string;
  claimed: boolean;
  filename: string;
  hash: string;
  id: string;
  uploaded_at: number;
  uploaded_by: string;
};
export const UPLOADS_ATTACHMENT_SCHEMA: z.ZodType<UploadsAttachment> = z.object(
  {
    bucket: z.string(),
    claimed: z.boolean(),
    filename: z.string(),
    hash: z.string(),
    id: z.string(),
    uploaded_at: z.number(),
    uploaded_by: z.string(),
  },
);

/** A user from the API. */
export type User = {
  _id: string;
  avatar: string;
  avatar_color: string;
  banned: boolean;
  created: number | null;
  flags: number;
  last_seen: number | null;
  lower_username: string;
  lvl: number;
  permissions: number | null;
  pfp_data: number | null;
  quote: string | null;
  uuid: string | null;
};
export const USER_SCHEMA: z.ZodType<User> = z.object({
  _id: z.string(),
  avatar: z.string(),
  avatar_color: z.string(),
  banned: z.boolean(),
  created: z.number().nullable(),
  flags: z.number(),
  last_seen: z.number().nullable(),
  lower_username: z.string(),
  lvl: z.number(),
  permissions: z.number().nullable(),
  pfp_data: z.number().nullable(),
  quote: z.string().nullable(),
  uuid: z.string().nullable(),
});

export const API_USER_SCHEMA = USER_SCHEMA.and(
  z.object({ error: z.literal(false) }),
).or(z.object({ error: z.literal(true), type: z.string() }));
