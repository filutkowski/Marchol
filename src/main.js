import { app, BrowserWindow, Menu, dialog } from "electron";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import msfile from "./extensions/msfile.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
const wss = new WebSocketServer({ port: 8080 });

async function main() {
  // WebSocket obsługa
  wss.on("connection", (ws) => {
    console.log("Klient połączony");

    ws.on("message", (message) => {
      let decodedMessage = message.toString();
      console.log("Otrzymano wiadomość:", decodedMessage);

      // Dodaj "http://" jeśli brakuje protokołu
      if (
        !decodedMessage.startsWith("http://") &&
        !decodedMessage.startsWith("https://")
      ) {
        decodedMessage = `http://${decodedMessage}`;
      }

      if (mainWindow) {
        mainWindow.loadURL(decodedMessage); // Załaduj poprawiony URL
      } else {
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
            mainWindow.loadFile(path.join(__dirname, "home", "index.html")); // Załaduj stronę główną
          } else {
            console.error("Okno główne nie istnieje.");
          }
        },
      },
      {
        label: "Z pliku",
        click: () => {
          let files = dialog.showOpenDialogSync(mainWindow, {
            properties: ["openFile"],
            filters: [
              { name: "Pliki strony internetowej [.html]", extensions: ["html"] },
              { name: "Wszystkie pliki", extensions: ["*"] },
            ],
          });

          if (files && files[0]) {
            msfile(files[0], mainWindow); // Wywołanie funkcji obsługującej plik
          } else {
            console.error("Nie wybrano pliku.");
          }
        },
      },
      {
        label: "SVG",
        click: () => {
          let files = dialog.showOpenDialogSync(mainWindow, {
            properties: ["openFile"],
            filters: [
              { name: "Pliki SVG", extensions: ["svg"] },
              { name: "Wszystkie pliki", extensions: ["*"] },
            ],
          });

          if (files && files[0]) {
            const svgPath = path.join(__dirname, "svg", "image.svg");

            if (fs.existsSync(svgPath)) {
              fs.unlinkSync(svgPath); // Usuń stary plik
            }

            fs.copyFileSync(files[0], svgPath); // Skopiuj nowy plik
            mainWindow.loadFile(path.join(__dirname, "svg", "index.html")); // Załaduj SVG
          } else {
            console.error("Nie wybrano pliku SVG.");
          }
        },
      },
      {
        label: "Google",
        click: () => {
          if (mainWindow) {
            mainWindow.loadURL("http://google.com");
          } else {
            console.error("Okno główne nie istnieje.");
          }
        },
      },
      {
        label: "Bing",
        click: () => {
          if (mainWindow) {
            mainWindow.loadURL("http://bing.com");
          } else {
            console.error("Okno główne nie istnieje.");
          }
        },
    }, {
        label: "⋮",
        submenu: [
            {
                label: "otwórz narzędzia deweloperskie",
                click: () => {
                    mainWindow.webContents.toggleDevTools();
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

    createMenu(); // Ustaw menu
    mainWindow.loadFile(path.join(__dirname, "home", "index.html")); // Załaduj stronę główną

    mainWindow.on("closed", () => {
      mainWindow = null; // Wyczyść referencję
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