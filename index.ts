/*
yes this code might suck
yes if it does i might actually do something about that
please tell me if it sucks
-cat water arrow stripes and all the other usernames ive used here
*/

import "@std/dotenv/load";
import { RoarBot } from "@mbw/roarbot"
import { Notification } from "deno_notify"

import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'

import { serveFile } from "@std/http/file-server"
  
const db = new Low(new JSONFile('db.json'), null)
await db.read()
if (!db.data) db.data = {"users": {}};
console.log(db.data)


function doDefaultUserStuff(user) {
    if (!db.data.users.hasOwnProperty(user)) {
        db.data.users[user] = {money: 0, lastLabor: 0, inventory: []}
    }
}

const cooldown = 10 * 60 * 1000

const Meowy = new RoarBot({
    admins: JSON.parse(Deno.env.get("MEOWY_ADMINS")!),
    help: false
});

Meowy.command("help", {
    args: [],
    fn: async (reply) => {
        await reply("**Commands:**\n*General:*\nhelp - you know what this does\nmeow - meow :3\nnotify - notify cat!\ncolor - change meowys color!\n*Economy*:\nbalance - see how much you have!\nlabor - work for below minimum wage!")
    }
})

Meowy.command("meow", {
    args: [],
    fn: async (reply) => {
        await reply("meow :3")
    }
})

Meowy.command("notify", {
    args: [{type:"full", name:"notification"}],
    fn: async (reply, [notif], post) => {
        new Notification({linux:true}).title(`@${post.u} sent:`).body(notif)
        .timeout('never')
        .show()
        await reply("sent notification to cat's puter! :3")
    }
})

Meowy.command("color", {
    args: [{type:"string", name:"color", optional: true}],
    fn: async (reply, [color]) => {
        if (!color) {
            await Meowy.setAccountSettings({avatarColor: Math.floor(Math.random() * 2 ** 24).toString(16).padStart(6, "0")})
            await reply("profile color randomized!")
            return
        }
        if (!/^([0-9a-f]{6})$/.test(color)) {
            await reply("invalid syntax! use a color like `f9a535` :3")
            return
        }
        await Meowy.setAccountSettings({avatarColor: color})
        await reply("profile color set! :3")
    }
})

Meowy.command("labor", {
    args: [],
    fn: async (reply, _, post) => {
        const user = post.u
        await doDefaultUserStuff(user)
        if ((db.data.users[user].lastLabor + cooldown) > Date.now()) {
            await reply(`This command can only be used once every ten minutes!\n-# Wait ${Math.ceil(((db.data.users[user].lastLabor + cooldown) - Date.now()) / (60 * 1000))} more minute(s) before trying again.`)
            return;
        }
        const moneyMade = Math.random() * 1.357 + 0.52
        db.data.users[user].money += moneyMade
        db.data.users[user].lastLabor = Date.now()
        await db.write()
        await reply(`You did an cooldown of work and got $${moneyMade.toFixed(2)}.\n-# Your balance is now $${db.data.users[user].money.toFixed(2)}.`)
    }
})

Meowy.command("balance", {
    args: [],
    fn: async (reply, _, post) => {
        const user = post.u
        if (db.data.users.hasOwnProperty(user)) {
            await reply(`Your balance is $${db.data.users[user].money.toFixed(2)}.\n-# Better hit the mines or hit the casinos.`)
        } else {
            await reply(`Welp, you're broke.\n-# Do @Meowy labor to work for below minimum wage!`)
        }
    }
})

Meowy.login(Deno.env.get("MEOWY_USERNAME")!,Deno.env.get("MEOWY_PASSWORD")!)

Deno.serve({port: 3621, hostname:"127.0.0.1"},(req) => {
    if (req.headers.get("upgrade") != "websocket") {
        return serveFile(req, "./controlpanel.html")
    }

    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.addEventListener("open", () => {
        console.log("control panel connection!");
    });

    socket.addEventListener("message", (event) => {
        console.log("Got command: " + event.data)
        console.log("------")
        try {
            socket.send(eval(event.data));
        } catch(e) {
            socket.send(e)
        }
    });

    return response;
});

