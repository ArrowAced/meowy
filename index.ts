import "@std/dotenv/load";
import { RoarBot } from "@mbw/roarbot"

const Meowy = new RoarBot({
    admins: JSON.parse(Deno.env.get("MEOWY_ADMINS")!),
    help: false
});

Meowy.command("help", {
    args: [],
    fn: (reply) => {
        reply("Commands:\nhelp - You know what this does.")
    }
})

Meowy.command("meow", {
    args: [],
    fn: (reply) => {
        reply("meow :3")
    }
})

Meowy.login(Deno.env.get("MEOWY_USERNAME")!,Deno.env.get("MEOWY_PASSWORD")!)