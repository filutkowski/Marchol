import express, { Application, Request, Response } from "express";
import path from "path";
import { BrowserWindow } from "electron";

let server: ReturnType<Application["listen"]> | null = null;
let renderApp: Application = express();

const Msfile = (file: string, electronApp: BrowserWindow): void => {
    if (server) {
        server.close(() => {
            console.log("Poprzedni serwer Express został zatrzymany.");
        });
        server = null;
        renderApp = express();
    }

    renderApp.use(express.static(path.resolve(path.dirname(file))));

    renderApp.get("/", (req: Request, res: Response) => {
        res.sendFile(path.resolve(file));
    });

    server = renderApp.listen(3350, () => {
        console.log("Serwer uruchomiony na porcie 3350");
    });

    electronApp.loadURL("http://localhost:3350");
};

export default Msfile;