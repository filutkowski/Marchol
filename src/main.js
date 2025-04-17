import { app, BrowserWindow, Menu, dialog } from "electron";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import msfile from "./extensions/msfile.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mainWindow = null;
const wss = new WebSocketServer({ port: 8080 });
// Główna funkcja
async function main() {
    // Obsługa WebSocket
    wss.on("connection", (ws) => {
        console.log("Klient połączony");
        ws.on("message", (message) => {
            let decodedMessage = message.toString();
            console.log("Otrzymano wiadomość:", decodedMessage);
            // Dodaj "http://" jeśli brakuje protokołu
            if (!decodedMessage.startsWith("http://") &&
                !decodedMessage.startsWith("https://")) {
                decodedMessage = `http://${decodedMessage}`;
            }
            if (mainWindow) {
                mainWindow.loadURL(decodedMessage); // Załaduj poprawiony URL
            }
            else {
                console.error("Nie można załadować URL, okno nie istnieje.");
            }
            ws.send(`Otrzymałem poprawiony URL: ${decodedMessage}`);
        });
    });
    // Funkcja tworzenia menu
    function createMenu() {
        const menuTemplate = [
            {
                label: "Dom",
                click: () => {
                    if (mainWindow) {
                        mainWindow.loadFile(path.join(__dirname, "home", "index.html"));
                    }
                    else {
                        console.error("Okno główne nie istnieje.");
                    }
                },
            },
            {
                label: "SVG",
                click: () => {
                    const files = dialog.showOpenDialogSync(mainWindow, {
                        properties: ["openFile"],
                        filters: [
                            { name: "Pliki SVG", extensions: ["svg"] },
                            { name: "Wszystkie pliki", extensions: ["*"] },
                        ],
                    });
                    if (files && files[0]) {
                        const svgPath = path.join(__dirname, "svg", "image.svg");
                        try {
                            // Skopiuj plik SVG do lokalizacji
                            fs.copyFileSync(files[0], svgPath);
                            // Załaduj plik index.html
                            mainWindow?.loadFile(path.join(__dirname, "svg", "index.html"));
                        }
                        catch (err) {
                            console.error("Błąd podczas kopiowania pliku SVG:", err);
                        }
                    }
                    else {
                        console.error("Nie wybrano pliku SVG.");
                    }
                },
            },
            {
                label: "Z pliku",
                click: () => {
                    const files = dialog.showOpenDialogSync(mainWindow, {
                        properties: ["openFile"],
                        filters: [
                            { name: "Pliki HTML", extensions: ["html"] },
                            { name: "Wszystkie pliki", extensions: ["*"] },
                        ],
                    });
                    if (files && files[0]) {
                        msfile(files[0], mainWindow);
                    }
                    else {
                        console.error("Nie wybrano pliku.");
                    }
                },
            },
            { label: "Google", click: () => mainWindow?.loadURL("http://google.com") },
            { label: "Bing", click: () => mainWindow?.loadURL("http://bing.com") },
            {
                label: "⋮",
                submenu: [
                    {
                        label: "Otwórz narzędzia deweloperskie",
                        click: () => {
                            mainWindow?.webContents.toggleDevTools();
                        },
                    },
                ],
            },
        ];
        const menu = Menu.buildFromTemplate(menuTemplate);
        Menu.setApplicationMenu(menu);
    }
    // Tworzenie okna głównego
    function createWindow() {
        mainWindow = new BrowserWindow({
            width: 800,
            height: 600,
            webPreferences: {
                nodeIntegration: true,
            },
        });
        createMenu();
        mainWindow.loadFile(path.join(__dirname, "home", "index.html"));
        mainWindow.on("closed", () => {
            mainWindow = null;
        });
    }
    // Obsługa zdarzeń aplikacji
    app.on("ready", createWindow);
    app.on("window-all-closed", () => {
        if (process.platform !== "darwin") {
            app.quit();
        }
    });
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
}
main();
