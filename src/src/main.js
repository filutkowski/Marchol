import { app, BrowserWindow, Menu, session, BrowserView, dialog } from "electron";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "node:url";
import path from "path";
import fs from "fs";
import Msfile from "./extensions/msfile.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const CONFIG_PATH = path.join(__dirname, "conf", "global.json");
let data = JSON.parse(fs.readFileSync(CONFIG_PATH));
const lang = data.lang
const HISTORY_CONFIG_PATH = path.join(__dirname, "conf", "temp", "history.pud");
const HOME_PATH = path.join(__dirname, "lang", "assets", lang, "home.html")
const DEFAULTLANG = JSON.parse(fs.readFileSync(path.join(__dirname, "lang", lang + ".json"), "utf-8"));
const SETTINGS_PATH = path.join(__dirname, "lang", "assets", lang, "settings", "index.html")
const DOWNLOAD_PATH = path.join(__dirname, "lang", "assets", lang, "download.html")
const HISTORY_PATH = path.join(__dirname, "lang", "assets", lang, "history.html")


let Bounds;

let Tasks = [];
let focus = 0;
let ses;
let downloadGUI;
let historyGUI;
let downloadGUIWebSocket;
let historyGUIWebSocket;


const wss = new WebSocketServer({ port: 8080 });
const downloadWss = new WebSocketServer({ port: 2669 });
const historyWss = new WebSocketServer({ port: 2670 });
const settingsWss = new WebSocketServer({ port: 5555 });

function createWindow() {
    for (let i = 0; i < data.tabs; i++) {
        let win = new BrowserWindow({
            width: 800,
            height: 600,
            webPreferences: {
                nodeIntegration: true,
            },
            show: false, // nie pokazuj od razu
        });

        Tasks.push(win);
    }

    Tasks.forEach((win, i) => {
        if (i === 0) {
            win.setSkipTaskbar(false);
            win.show();
            win.maximize();
            ses = win.webContents.session;
            Bounds = win.getBounds();
            attachNavigationHandlers(win);
        } else {
            win.setSkipTaskbar(true);
            win.minimize();
        }
    });

    download();
}

function changeTask(number) {
    if (!Tasks[number]) {
        console.error(`Okno ${number} nie istnieje.`);
        return;
    }

    if (Tasks[focus]) {
        Tasks[focus].minimize();
        Tasks[focus].setSkipTaskbar(true);
    }

    focus = number;
    Tasks[focus].setSkipTaskbar(false);
    Tasks[focus].show();
    Tasks[focus].maximize();

    ses = Tasks[focus].webContents.session;
    Bounds = Tasks[focus].getBounds();
    attachNavigationHandlers(Tasks[focus]);
    download();
}

function attachNavigationHandlers(win) {
    win.webContents.on("did-navigate", (_event, url) => {
        Wil(url);
    });
    win.webContents.on("did-navigate-in-page", (_event, url) => {
        Wil(url);
    });
}

async function main() {
    wss.on("connection", (ws) => {
        ws.on("message", (message) => {
            let decodedMessage = message.toString();

            if (!decodedMessage.startsWith("http://") && !decodedMessage.startsWith("https://")) {
                decodedMessage = `http://${decodedMessage}`;
            }

            if (!Tasks[focus]) return;

            Tasks[focus].loadURL(decodedMessage);
            Wil(decodedMessage);
            ws.send(`Otrzymałem poprawiony URL: ${decodedMessage}`);
        });
    });

    downloadWss.on("connection", (ws) => {
        downloadGUIWebSocket = ws;
    });

    historyWss.on("connection", (ws) => {
        historyGUIWebSocket = ws;

        if (fs.existsSync(HISTORY_CONFIG_PATH)) {
            const historyData = fs.readFileSync(HISTORY_CONFIG_PATH, "utf-8");
            ws.send(historyData);
        }
    });

    settingsWss.on("connection", (ws) => {
        ws.send(JSON.stringify({ incognito: data.incognito, tabs: data.tabs }));

        ws.on("message", (event) => {
            try {
                const updated = JSON.parse(event.toString());
                const updatedData = {
                    incognito: Boolean(updated.incognito),
                    tabs: Number(updated.tabs),
                };

                fs.writeFileSync(CONFIG_PATH, JSON.stringify(updatedData, null, 2));

                [wss, downloadWss, historyWss, settingsWss].forEach(server => {
                    server.clients.forEach(client => {
                        if (client.readyState === client.OPEN) {
                            client.close();
                        }
                    });
                });

                if (downloadGUIWebSocket?.readyState === downloadGUIWebSocket.OPEN) {
                    downloadGUIWebSocket.close();
                }

                app.relaunch();
                app.exit();
            } catch (error) {
                console.error("Błąd przetwarzania ustawień:", error.message);
            }
        });
    });

    createWindow();
    createMenu();

    Tasks[focus].loadFile(HOME_PATH);
}

function createMenu() {
    const cards = Array.from({ length: data.tabs }, (_, i) => ({
        label:  DEFAULTLANG["menu-cards"] + " " + (i + 1),
        click: () => changeTask(i),
    }));

    const menuTemplate = [
        {
            label: DEFAULTLANG["menu-tabs"],
            submenu: cards,
        },
        {
            label: DEFAULTLANG["menu-home"],
            click: () => {
                if (!Tasks[focus]) return;
                Tasks[focus].loadFile(HOME_PATH);
                Wil("home");
            },
        },
        {
            label: DEFAULTLANG["menu-google"],
            click: () => {
                if (!Tasks[focus]) return;
                Tasks[focus].loadURL("http://google.com");
                Wil("http://google.com");
            },
        },
        {
            label: DEFAULTLANG["menu-bing"],
            click: () => {
                if (!Tasks[focus]) return;
                Tasks[focus].loadURL("http://bing.com");
                Wil("http://bing.com");
            },
        },
        {
            label: DEFAULTLANG["menu-fromFile"],
            click: () => {
                if (!Tasks[focus]) return;
                let files = dialog.showOpenDialogSync(Tasks[focus], {
                    properties: ["openFile"],
                    filters: [
                        { name: DEFAULTLANG["dialog-fileFilters-html"], extensions: ["html"] },
                        { name: DEFAULTLANG["dialog-fileFilters-images"], extensions: ["svg", "png", "bmp", "webp", "jpg"] },
                        { name: DEFAULTLANG["dialog-fileFilters-all"], extensions: ["*"] },
                    ],
                });

                if (files && files[0]) {
                    Msfile(files[0], Tasks[focus]);
                }
            },
        },
        {
            label: "⋮",
            submenu: [
                {
                    label: DEFAULTLANG["menu-devTools"],
                    click: () => {
                        if (!Tasks[focus]) return;
                        Tasks[focus].webContents.toggleDevTools();
                    },
                },
                {
                    label: DEFAULTLANG["menu-settings"],
                    click: () => {
                        Tasks[focus].loadFile(SETTINGS_PATH);
                        
                  },
                },

            ],
        },
        {
            label: DEFAULTLANG["menu-history"],
            submenu: [
                {
                    label: DEFAULTLANG["menu-history-open"],
                    click: () => {
                        historyStart();
                    },
                },
                {
                    label: DEFAULTLANG["menu-history-close"],
                    click: () => {
                        historyStop();
                    },
                },
                {
                    label: DEFAULTLANG["menu-history-clear"],
                    click: () => {
                        fs.writeFileSync(HISTORY_CONFIG_PATH, "");
                    },
                },

            ],
        },
        {
            label: "language (język)",
            submenu: [
                {
                    label: "English (Angielski)",
                    click: () => {
                        data.lang = "en-en"
                        const updatedData = {
                            incognito: Boolean(data.incognito),
                            tabs: Number(data.tabs),
                            lang: String(data.lang),
                        };
        
                        fs.writeFileSync(CONFIG_PATH, JSON.stringify(updatedData, null, 2));
                        app.relaunch();
                        app.exit();
                    },
                },
                {
                    label: "Polski (Polish)",
                    click: () => {
                        data.lang = "pl-pl"
                        const updatedData = {
                            incognito: Boolean(data.incognito),
                            tabs: Number(data.tabs),
                            lang: String(data.lang),
                        };
        
                        fs.writeFileSync(CONFIG_PATH, JSON.stringify(updatedData, null, 2));
                        app.relaunch();
                        app.exit();
                    },
                },
                {
                    label: "Deutsch (Niemiecki)",
                    click: () => {
                        data.lang = "de-de"
                        const updatedData = {
                            incognito: Boolean(data.incognito),
                            tabs: Number(data.tabs),
                            lang: String(data.lang),
                        };
        
                        fs.writeFileSync(CONFIG_PATH, JSON.stringify(updatedData, null, 2));
                        app.relaunch();
                        app.exit();
                    },
                }
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}

app.on("ready", main);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
        createMenu();
    }
});

async function download() {
    if (!ses) return;

    ses.on("will-download", (event, item) => {
        downloadGUI = new BrowserView();
        Tasks[focus].setBrowserView(downloadGUI);
        downloadGUI.setBounds({ x: 0, y: 0, width: 400, height: 200 });
        downloadGUI.webContents.loadFile(DOWNLOAD_PATH);

        if (downloadGUIWebSocket?.readyState === 1) {
            downloadGUIWebSocket.send(item.getFilename());
        }

        item.once("done", (_event, state) => {
            Tasks[focus].removeBrowserView(downloadGUI);
            downloadGUI = null;
        });
    });
}

async function Wil(url) {
    if (!url || data.incognito) return;

    const homePath = "file:///" + (HOME_PATH.replace(/\\/g, "/"));

    try {
        const entry = url !== homePath ? `${url}\n` : "home\n";
        fs.appendFileSync(HISTORY_CONFIG_PATH, entry);
        console.log(`Dodano do historii: ${url}`);
    } catch (err) {
        console.error("Błąd zapisu historii:", err.message);
    }
}

async function historyStart() {
    if (historyGUI) return;

    historyGUI = new BrowserView();
    Tasks[focus].setBrowserView(historyGUI);
    historyGUI.setBounds({ x: 0, y: 0, width: 400, height: 200 });
    historyGUI.webContents.loadFile(HISTORY_PATH);
}

async function historyStop() {
    if (historyGUI) {
        Tasks[focus].removeBrowserView(historyGUI);
        historyGUI.destroy();
        historyGUI = null;
        console.log("Widok historii został zamknięty.");
    }
}
