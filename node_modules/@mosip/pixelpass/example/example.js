const open = require('open');
const express = require('express')
const path = require('path');
const {generateQRCode, generateQRData} = require('../src')
const QRCode = require("qrcode");
const {
    DEFAULT_QR_QUALITY,
    DEFAULT_QR_BORDER,
    DEFAULT_QR_SCALE,
    COLOR_BLACK,
    COLOR_WHITE, DEFAULT_ECC_LEVEL
} = require("../src/shared/Constants");

const app = express()
const port = 3000

app.use(express.json())
app.get('/', (req, res) => {
    const options = {
        root: path.join(__dirname)
    };
    res.sendFile("index.html", options)
})

app.get('/styles.css', (req, res) => {
    const options = {
        root: path.join(__dirname)
    };
    res.sendFile("stylesheet.css", options)
})

app.post('/qr', (req, res) => {
    let json = req.body
    console.log("JSON RECEIVED : ", json)
    const opts = {
        errorCorrectionLevel: DEFAULT_ECC_LEVEL,
        quality: DEFAULT_QR_QUALITY,
        margin: DEFAULT_QR_BORDER,
        scale: DEFAULT_QR_SCALE,
        color: {
            dark: COLOR_BLACK,
            light: COLOR_WHITE
        }
    }
    let qrData = generateQRData(JSON.stringify(json));
    let version = QRCode.create(qrData, {errorCorrectionLevel : DEFAULT_ECC_LEVEL}).version
    QRCode.toDataURL(qrData,opts).then(qr => res.send([version,qr]))
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
    open('http://localhost:3000');
})