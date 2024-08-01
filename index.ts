import "@std/dotenv/load";
import { RoarBot } from "@mbw/roarbot"
const Meowy = new RoarBot({
    admins: JSON.parse(Deno.env.get("MEOWY_ADMINS")!),
    help: false
});

Meowy.command("help", {
    args: [],
    fn: (reply) => {
        reply("@Meowy help - You know what this does.")
    }
})

Meowy.login(Deno.env.get("MEOWY_USERNAME")!,Deno.env.get("MEOWY_PASSWORD")!)