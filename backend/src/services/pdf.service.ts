import puppeteer, { type Browser } from "puppeteer";

// Una sola instancia de Chromium compartida entre peticiones: lanzar un
// navegador por request es lento y consume demasiada memoria.
let browserPromise: Promise<Browser> | null = null;

const getBrowser = async (): Promise<Browser> => {
    if (!browserPromise) {
        browserPromise = puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        // Si el lanzamiento falla, se limpia la promesa para reintentar en la siguiente llamada
        browserPromise.catch(() => {
            browserPromise = null;
        });
    }

    return browserPromise;
};

/**
 * Renderiza HTML a un PDF (buffer) usando la instancia compartida de Chromium.
 */
export const renderPdfFromHtml = async (html: string): Promise<Buffer> => {
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        await page.setContent(html, { waitUntil: "load" });

        const pdfUint8Array = await page.pdf({
            format: "letter",
            printBackground: true,
            margin: { top: "18mm", bottom: "16mm", left: "14mm", right: "14mm" },
        });

        return Buffer.from(pdfUint8Array);
    } finally {
        await page.close();
    }
};

/** Cierra el navegador compartido. Llamar al apagar el servidor. */
export const closeBrowser = async (): Promise<void> => {
    if (!browserPromise) return;

    const browser = await browserPromise;
    browserPromise = null;
    await browser.close();
};
