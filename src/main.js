import { app, BrowserWindow, Menu, session, BrowserView, dialog } from "electron";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import Msfile from "./extensions/msfile.mjs"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let Bounds;
let Tasks = [];
let focus = 0;
let ses
let downloadGUI
let historyGUI
let downloadGUIWebSocket;
let historyGUIWebSocket;

const wss = new WebSocketServer({ port: 8080 });
const downloadWss = new WebSocketServer({ port: 2669 });
const historyWss = new WebSocketServer({ port: 2670 });

function createWindow() {
    for (let i = 0; i < 20; i++) {
        let win = new BrowserWindow({
            width: 800,
            height: 600,
            webPreferences: {
                nodeIntegration: true,
            },
            movable: false,
            resizable: false,
            minimizable: false,
        });

        win.setSkipTaskbar(true);
        Tasks.push(win);
    }

    Tasks[focus].maximize();
    Tasks[focus].setSkipTaskbar(false);
    ses = Tasks[focus].webContents.session;
    Bounds = Tasks[focus].getBounds();
    attachNavigationHandlers(Tasks[focus]);
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
    Tasks[focus].restore();
    Tasks[focus].setSkipTaskbar(false);
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
        console.log("Klient połączony");

        ws.on("message", (message) => {
            let decodedMessage = message.toString();
            console.log("Otrzymano wiadomość:", decodedMessage);

            if (!decodedMessage.startsWith("http://") && !decodedMessage.startsWith("https://")) {
                decodedMessage = `http://${decodedMessage}`;
            }

            if (!Tasks[focus]) {
                console.error("Tasks[focus] nie istnieje.");
                return;
            }

            Tasks[focus].loadURL(decodedMessage);
            Wil(decodedMessage);
            ws.send(`Otrzymałem poprawiony URL: ${decodedMessage}`);
        });

        ws.on("close", () => console.log("Klient rozłączył się"));
        ws.on("error", (error) => console.error("Błąd WebSocket:", error));
    });

    downloadWss.on("connection", (ws) => {
        console.log("Klient połączony do downloadWss");
        downloadGUIWebSocket = ws;

        ws.on("close", () => {
            console.log("Klient rozłączył się (downloadWss)");
        });

        ws.on("error", (error) => {
            console.error("Błąd WebSocket (downloadWss):", error);
        });
    });

    historyWss.on("connection", (ws) => {
        console.log("Klient połączony do historyWss");
        historyGUIWebSocket = ws;

        const historyPath = path.join(__dirname, "conf", "temp", "history.pud");
        if (fs.existsSync(historyPath)) {
            const historyData = fs.readFileSync(historyPath, "utf-8");
            ws.send(historyData);
        }

        ws.on("close", () => {
            console.log("Klient rozłączył się (historyWss)");
        });

        ws.on("error", (error) => {
            console.error("Błąd WebSocket (historyWss):", error);
        });
    });

    createWindow();
    createMenu();

    Tasks[focus].loadFile(path.join(__dirname, "home", "index.html"));

    Tasks[focus].on("closed", () => {
        Tasks[focus] = null;
    });
}

function createMenu() {
    const cards = Array.from({ length: 20 }, (_, i) => ({
        label: `Karta ${i + 1}`,
        click: () => changeTask(i),
    }));

    const menuTemplate = [
        {
            label: "karty",
            submenu: cards,
        },
        {
            label: "Dom",
            click: () => {
                if (!Tasks[focus]) return;
                Tasks[focus].loadFile(path.join(__dirname, "home", "index.html"));
                Wil("home");
            },
        },
        {
            label: "Google",
            click: () => {
                if (!Tasks[focus]) return;
                Tasks[focus].loadURL("http://google.com");
                Wil("http://google.com");
            },
        },
        {
            label: "Bing",
            click: () => {
                if (!Tasks[focus]) return;
                Tasks[focus].loadURL("http://bing.com");
                Wil("http://bing.com");
            },
        },
        {
            label: "Z pliku",
            click: () => {
                if (!Tasks[focus]) return;
                let files = dialog.showOpenDialogSync(Tasks[focus], {
                    properties: ["openFile"],
                    filters: [
                        { name: "Pliki HTML", extensions: ["html"] },
                        { name: "Obrazy", extensions: ["svg", "png", "bmp", "webp", "jpg"] },
                        { name: "Wszystkie", extensions: ["*"] },
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
                    label: "Otwórz narzędzia deweloperskie",
                    click: () => {
                        if (!Tasks[focus]) return;
                        Tasks[focus].webContents.toggleDevTools();
                    },
                },
            ],
        },
        {
            label: "historia",
            submenu: [
                {
                    label: "Otwórz historię",
                    click: () => {
                        historyStart();
                    },
                },
                {
                    label: "Zamknij historię",
                    click: () => {
                        historyStop();
                    },
                },
                {
                    label: "Wyczyść historię",
                    click: () => {
                        fs.unlinkSync(path.join(__dirname, "conf", "temp", "history.pud"))
                        fs.writeFileSync(path.join(__dirname, "conf", "temp", "history.pud") ,"")
                    },
                },
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
    if (!ses) {
        console.error("Sesja nie została zainicjowana.");
        return;
    }

    ses.on("will-download", (event, item) => {
        console.log(`Rozpoczęto pobieranie: ${item.getFilename()}`);

        downloadGUI = new BrowserView();
        Tasks[focus].setBrowserView(downloadGUI);
        downloadGUI.setBounds({ x: 0, y: 0, width: 400, height: 200 });
        downloadGUI.webContents.loadFile(path.join(__dirname, "download.html"));

        if (downloadGUIWebSocket && downloadGUIWebSocket.readyState === 1) {
            downloadGUIWebSocket.send(item.getFilename());
        }

        item.once("done", (_event, state) => {
            if (state === "completed") {
                console.log(`Pobieranie zakończone: ${item.getFilename()}`);
            } else {
                console.log(`Pobieranie nie powiodło się: ${item.getFilename()}`);
            }

            Tasks[focus].removeBrowserView(downloadGUI);
            downloadGUI = null;
        });
    });
}

async function Wil(url) {
    if (!url) return;

    try {
        if (url != "file:///" + path.join(__dirname, "home", "index.html")) {
        fs.appendFileSync(
            path.join(__dirname, "conf", "temp", "history.pud"),
            `${url}\n`
        );

    }
    else {
        fs.appendFileSync(
            path.join(__dirname, "conf", "temp", "history.pud"),
        "home"
        );
    }
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
    historyGUI.webContents.loadFile(path.join(__dirname, "history.html"));
}

async function historyStop() {
    if (historyGUI) {
        Tasks[focus].removeBrowserView(historyGUI);
        historyGUI.destroy();
        historyGUI = null;
        console.log("Widok historii został zamknięty.");
    }
}

// Dodaj własną funkcję jeśli chcesz wspierać otwieranie z pliku
