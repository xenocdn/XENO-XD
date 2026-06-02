// XENO EXE ✅

import express from "express";
import pino from "pino";
import fs from "fs-extra";
import User from "./lib/user.js";
import generateid from "./lib/id.js";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import { dirname } from "path";
import makeWASocket, {
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";
import connectDatabase from "./lib/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.set("json spaces", 4)
connectDatabase();

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/lib/pair.html");
});

if (fs.existsSync("./session")) {
    fs.emptyDirSync(__dirname + "/session");
}
console.log("folder cleaned");

app.get("/session", async (req, res) => {
    const id = req.query.id;
    if (!id) return res.json({
        status: false,
        message: "session id required"
    });
    const user = await User.findOne({
        sessionId: id.split('~')[1] || id.split(':')[1] || id
    });

    if (!user) return res.json({
        status: false,
        message: "Session not found"
    });

    return res.json({
        status: true,
        creator: "XENO EXE",
        data: user.creds
    });
})

app.get("/pairing", async (req, res) => {
    let num = req.query.number;

    async function xenoPair() {
        const { state, saveCreds } = await useMultiFileAuthState("./session");
        try {
            const { version, isLatest } = await fetchLatestBaileysVersion();
            console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);
            let xeno = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                version,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: ["Ubuntu", "Chrome", "124.0.0"],
            });

            if (!xeno.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, "");
                const code = await xeno.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            xeno.ev.on("creds.update", saveCreds);

            xeno.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    await delay(10000);
                    const sessionxeno = fs.readFileSync("./session/creds.json", "utf8");
                    let encoded = generateid();
                    const userJid = xeno.user?.id?.replace(/:.*@/, '@');
                    let session = await xeno.sendMessage(userJid, {
                        text: "XenoExe~" + encoded,
                    });
                    let text =
                        "*Thank You for Using XENO_EXE_MD*\n\n\nDeveloper Contact: +919645991937\n\nOfficial Channel: https://instagram.com/x3n0.s8r\n\nWe appreciate your feedback and are here to assist you!";
                    await xeno.sendMessage(
                        userJid,
                        { text },
                        { quoted: session }
                    );
                    const user = await User.create({
                        sessionId: encoded,
                        creds: sessionxeno
                    })
                    console.log(user);
                    await delay(3000);
                    fs.emptyDirSync(__dirname + "/session");
                    console.log("_Restarting..._");
                    process.exit(0);
                } else if (
                    connection === "close" &&
                    lastDisconnect?.error?.output?.statusCode !== 401
                ) {
                    await delay(10000);
                    xenoPair();
                }
            });
        } catch (err) {
            console.log("service restarted");
            fs.emptyDirSync(__dirname + "/session");
            if (!res.headersSent) {
                await res.send({ code: "Service Unavailable" });
            }
            console.log(err);
        }
    }

    return await xenoPair();
});

app.listen(PORT, () => console.log("App listened on port", PORT));
