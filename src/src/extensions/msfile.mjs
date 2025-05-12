import express from "express";
import path from "path";
let server;
let renderApp = express();
const Msfile = (file, electronApp) => {
    if (server) {
        server.close(() => {
            console.log("Poprzedni serwer Express został zatrzymany.");
        }
    );
    server = null;
    renderApp = null;
    renderApp = express();
    }

    renderApp.use(express.static(path.resolve(path.dirname(file))));
    renderApp.get("/", (req, res) => {
        res.sendFile(path.resolve(file))
    })
    server = renderApp.listen(3350);
    electronApp.loadURL("http://localhost:3350");
  };
  export default Msfile;
