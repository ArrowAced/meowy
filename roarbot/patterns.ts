import type { Messages } from "./mod.ts";

/**
 * Possible types of patterns to a command.
 * - `"string"`: Any string
 * - `"number"`: Any floating point number
 * - `"full"`: A string that matches until the end of the command.
 * - `string[]`: One of the specified strings
 */
export type PatternType = "string" | "number" | "full" | string[];

/**
 * A list of arguments types. This is a list of objects formatted like this:
 * - type: A {@link PatternType}.
 * - optional: Whether it's optional or not. After an optional argument can only
 * be other optional arguments.
 * - name: The name of the argument.
 * If both the name and optional aren't given, the type can be standalone
 * without a wrapper object.
 *
 * @example Basic
 * ```js
 * ["number", "string"]
 * // @Bot cmd 2 4 → [2, "4"]
 * ```
 * @example `full`
 * ```js
 * [
 *   { type: "number", name: "amount" },
 *   { type: "full", name: "string" }
 * ]
 * // @Bot cmd 7 Hello, world! → [7, "Hello, world!"]
 * ```
 * @example Optionals
 * ```js
 * [
 *   { type: "string", name: "person to greet" },
 *   { type: "string", optional: true, name: "greeting to use" }
 * ]
 * // @Bot cmd Josh → ["Josh"]
 * // @Bot cmd Josh G'day → ["Josh", "G'day"]
 * ```
 */
export type Pattern = (
  | PatternType
  | { type: PatternType; name?: string; optional?: boolean }
)[];

/**
 * Converts the passed in `TPattern` to its corresponding TypeScript type.
 */
export type ResolvePattern<TPattern extends Pattern> = {
  [K in keyof TPattern]: K extends `${number}` ?
    TPattern[K] extends PatternType ? ResolvePatternType<TPattern[K]>
    : TPattern[K] extends { type: PatternType } ?
      TPattern[K] extends { optional: true } ?
        ResolvePatternType<TPattern[K]["type"]> | undefined
      : ResolvePatternType<TPattern[K]["type"]>
    : never
  : TPattern[K];
};
type ResolvePatternType<TArgument extends PatternType> =
  TArgument extends "string" ? string
  : TArgument extends "number" ? number
  : TArgument extends "full" ? string
  : TArgument extends string[] ? TArgument[number]
  : never;

export const parseArgs = <const TPattern extends Pattern>(
  pattern: TPattern,
  args: string[],
  messages: Messages,
):
  | { error: true; message: string }
  | { error: false; parsed: ResolvePattern<TPattern> } => {
  const parsed = [];
  let hadOptionals = false;
  let hadFull = false;
  for (const [i, slice] of pattern.entries()) {
    const isObject = typeof slice === "object" && "type" in slice;
    const type = isObject ? slice.type : slice;
    const optional = isObject && !!slice.optional;
    if (hadOptionals && !optional) {
      return {
        error: true,
        message:
          "In this command's pattern, there is an optional argument following a non-optional one.\nThis is an issue with the bot, not your command.",
      };
    }
    hadOptionals ||= optional;
    const name = isObject && !!slice.name;
    const repr = name ? `${slice.name} (${type})` : `${type}`;
    const current = args[i];
    if (!current) {
      if (optional) {
        continue;
      } else if (type !== "full") {
        return { error: true, message: messages.argsMissing(repr) };
      }
    }
    if (Array.isArray(type)) {
      if (!type.includes(current)) {
        return {
          error: true,
          message: messages.argsNotInSet(
            JSON.stringify(current),
            type.map((t) => JSON.stringify(t)).join(", "),
          ),
        };
      }
      parsed.push(current);
      continue;
    }
    switch (type) {
      case "string": {
        parsed.push(current);
        break;
      }
      case "number": {
        const number = Number(current);
        if (Number.isNaN(number)) {
          return {
            error: true,
            message: messages.argNan(JSON.stringify(current)),
          };
        }
        parsed.push(number);
        break;
      }
      case "full": {
        if (pattern[i + 1]) {
          return {
            error: true,
            message:
              "In this command's pattern, there is an argument following a `full` argument.\nThis is an issue with the bot, not your command.",
          };
        }
        hadFull = true;
        parsed.push(args.slice(i).join(" "));
        break;
      }
      default:
        (type) satisfies never;
    }
  }
  if (!hadFull && args.length !== parsed.length) {
    return { error: true, message: messages.tooManyArgs };
  }
  return { error: false, parsed: parsed as ResolvePattern<TPattern> };
};

/**
 * Turns the pattern type into a human readable format.
 * @param patternType The pattern type.
 */
export const stringifyPatternType = (patternType: PatternType): string => {
  return (
    typeof patternType === "string" ?
      patternType === "full" ?
        "full string"
      : patternType
    : patternType.map((option) => JSON.stringify(option)).join(" | ")
  );
};
