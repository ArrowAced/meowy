// deno-lint-ignore-file no-prototype-builtins

import "@std/dotenv/load";
import { RoarBot } from "@mbw/roarbot"
import { Notification } from "deno_notify"

import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
  
const db = new Low(new JSONFile('db.json'), null)
await db.read()
if (!db.data) db.data = {"users": {}};
console.log(db.data)

function doDefaultUserStuff(user) {
    if (!db.data.users.hasOwnProperty(user)) {
        db.data.users[user] = {money: 0, lastLabor: 0, inventory: []}
    }
}

const hour = 60 * 60 * 1000

const Meowy = new RoarBot({
    admins: JSON.parse(Deno.env.get("MEOWY_ADMINS")!),
    help: false
});

Meowy.command("help", {
    args: [],
    fn: (reply) => {
        reply("**Commands:**\n*General:*\nhelp - you know what this does\nmeow - meow :3\nnotify - notify cat!\n*Economy*:\nbalance - see how much you have!\nlabor - work for below minimum wage!")
    }
})

Meowy.command("meow", {
    args: [],
    fn: (reply) => {
        reply("meow :3")
    }
})

Meowy.command("notify", {
    args: [{type:"full", name:"notification"}],
    fn: (reply, [notif], post) => {
        if (notif == "engineer gaming") {
            console.log("not replying so that i dont die :3")
            new Notification({linux:true}).title(`@${post.u} sent:`).body(notif)
            return;
        }
        new Notification({linux:true}).title(`@${post.u} sent:`).body(notif)
        .timeout('never')
        .show()
        reply("sent notification to cat's puter! :3")
    }
})

Meowy.command("labor", {
    args: [],
    fn: async (reply, _, post) => {
        const user = post.u
        await doDefaultUserStuff(user)
        if ((db.data.users[user].lastLabor + hour) > Date.now()) {
            await reply(`This command can only be used once per hour!\n-# Wait ${Math.ceil(((db.data.users[user].lastLabor + hour) - Date.now()) / (60 * 1000))} more minute(s) before trying again.`)
            return;
        }
        const moneyMade = Math.random() * 0.452 + 0.17
        db.data.users[user].money += moneyMade
        db.data.users[user].lastLabor = Date.now()
        await db.write()
        await reply(`You do an hour of work and get $${moneyMade.toFixed(2)}.\n-# Your balance is now $${db.data.users[user].money.toFixed(2)}.`)
    }
})

Meowy.command("balance", {
    args: [],
    fn: (reply, _, post) => {
        const user = post.u
        if (db.data.users.hasOwnProperty(user)) {
            reply(`Your balance is $${db.data.users[user].money.toFixed(2)}.\n-# Better hit the mines or hit the casinos.`)
        } else {
            reply(`Welp, you're broke.\n-# Do @Meowy labor to work for below minimum wage!`)
        }
    }
})

function postcmd() {
    //Meowy.setAccountSettings({avatarColor: Math.floor(Math.random() * 2 ** 24).toString(16).padStart(6, "0")})
}


Meowy.login(Deno.env.get("MEOWY_USERNAME")!,Deno.env.get("MEOWY_PASSWORD")!)