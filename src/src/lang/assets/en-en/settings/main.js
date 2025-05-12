const ws = new WebSocket("ws://localhost:5555");
const incognitoel = document.getElementById("incognito");
const tabsel = document.getElementById("tabs");
let data = { incognito: false, tabs: "" }; // Domyślne wartości dla danych

// Obsługa wiadomości przychodzących z serwera WebSocket
ws.onmessage = (event) => {
    try {
        const incomingData = JSON.parse(event.data); // Parsowanie danych w try-catch
        data = { ...data, ...incomingData }; // Bezpieczna aktualizacja danych

        // Ustawienie wartości w polach tylko jeśli klucze istnieją
        if ('incognito' in data) {
            incognitoel.checked = Boolean(data.incognito); // Konwersja na Boolean
        }

        if ('tabs' in data) {
            tabsel.value = String(data.tabs); // Konwersja na String
        }
    } catch (error) {
        console.error("Błąd parsowania danych WebSocket:", error.message);
    }
};

// Obsługa zmiany wartości w polach input
document.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
        try {
            // Pobieranie nowych wartości z elementów
            const updatedIncognito = incognitoel.checked;
            const updatedTabs = tabsel.value;

            // Aktualizacja lokalnych danych
            data = { ...data, incognito: updatedIncognito, tabs: updatedTabs };

            // Wysyłanie danych do serwera WebSocket
            ws.send(JSON.stringify(data));
        } catch (error) {
            console.error("Błąd podczas wysyłania danych WebSocket:", error.message);
        }
        console.log("OK")
    });
});