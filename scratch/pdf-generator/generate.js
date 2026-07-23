const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
    try {
        const possiblePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
        ];
        
        let executablePath = undefined;
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                executablePath = p;
                break;
            }
        }
        
        const browser = await puppeteer.launch({
            executablePath: executablePath
        });
        const page = await browser.newPage();
        
        const htmlPath = path.resolve(__dirname, 'presentation.html');
        await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
        
        const pdfPath = path.resolve(__dirname, 'ConnectED_System_Implementation.pdf');
        
        await page.pdf({
            path: pdfPath,
            format: 'Letter',
            printBackground: true,
            margin: {
                top: '0',
                bottom: '0',
                left: '0',
                right: '0'
            }
        });
        
        console.log(`PDF generated successfully at: ${pdfPath}`);
        await browser.close();
    } catch (error) {
        console.error('Error generating PDF:', error);
    }
})();
