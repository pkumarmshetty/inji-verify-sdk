

import { fromString } from 'uint8arrays/from-string';
import { decode, decodeBinary } from "@mosip/pixelpass";
import * as pdfjsLib from "pdfjs-dist";
import jsQR from 'jsqr';
import { BrowserQRCodeReader } from '@zxing/library';

// Set PDF.js worker using local bundled file (not CDN - avoids corporate network issues)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const HEADER_DELIMITER = '';
const SUPPORTED_QR_HEADERS = [''];
const ZIP_HEADER = "PK";




const readQRcodeFromImageFile = async (file, format, isPDF) => {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');

    if (!(file instanceof Blob || file instanceof File)) {
      return reject(new Error('Invalid file type'));
    }

    img.src = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);

        if (code && code.data) {

          resolve(code.data);
        } else {

          if (!isPDF) reject(new Error(`No ${format} found`));
          else resolve(null);
        }
      } catch (error) {
        console.error('Error decoding QR code with jsQR:', error);
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
  });
};

const jsQRScan = (imageData) => {
  const { data, width, height } = imageData;

  // Try original
  let code = jsQR(data, width, height);
  if (code) return code.data;

  // Try multiple binarization thresholds
  for (const threshold of [100, 128, 160, 80]) {
    const bw = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const val = gray > threshold ? 255 : 0;
      bw[i] = val;
      bw[i + 1] = val;
      bw[i + 2] = val;
      bw[i + 3] = 255;
    }
    code = jsQR(bw, width, height);
    if (code) return code.data;
  }

  // Try inverted
  const inv = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    inv[i] = 255 - data[i];
    inv[i + 1] = 255 - data[i + 1];
    inv[i + 2] = 255 - data[i + 2];
    inv[i + 3] = 255;
  }
  code = jsQR(inv, width, height);
  if (code) return code.data;

  return null;
};

const scanCanvasForQR = async (canvas) => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Force alpha to 255
  for (let i = 3; i < imageData.data.length; i += 4) {
    imageData.data[i] = 255;
  }

  // Try jsQR with multiple thresholds
  let result = jsQRScan(imageData);
  if (result) return result;

  // ZXing fallback via data URL
  try {
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = canvas.width;
    tmpCanvas.height = canvas.height;
    const tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.putImageData(imageData, 0, 0);

    const codeReader = new BrowserQRCodeReader();
    const decoded = await codeReader.decodeFromImageUrl(tmpCanvas.toDataURL('image/png'));
    if (decoded && decoded.text) return decoded.text;
  } catch (e) { /* zxing failed */ }

  return null;
};

const cropCanvas = (sourceCanvas, x, y, w, h) => {
  const cropped = document.createElement('canvas');
  cropped.width = w;
  cropped.height = h;
  const ctx = cropped.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(sourceCanvas, x, y, w, h, 0, 0, w, h);
  return cropped;
};

const renderPage = async (page, scale) => {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
};

const scanPageForQR = async (page, scale) => {
  const canvas = await renderPage(page, scale);
  const w = canvas.width;
  const h = canvas.height;

  const regions = [
    [Math.floor(w * 0.6), Math.floor(h * 0.75), Math.floor(w * 0.4), Math.floor(h * 0.25)],
    [Math.floor(w * 0.55), Math.floor(h * 0.3), Math.floor(w * 0.45), Math.floor(h * 0.45)],
    [Math.floor(w / 2), Math.floor(h / 2), Math.floor(w / 2), Math.floor(h / 2)],
    [0, Math.floor(h / 2), w, Math.floor(h / 2)],
    [Math.floor(w / 2), 0, Math.floor(w / 2), Math.floor(h / 2)],
    [0, 0, w, h],
  ];

  for (const [rx, ry, rw, rh] of regions) {
    const cropped = cropCanvas(canvas, rx, ry, rw, rh);
    const qr = await scanCanvasForQR(cropped);
    if (qr) return qr;
  }
  return null;
};

const readQRcodeFromPdf = async (file, format) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  console.log('[SDK] PDF loaded:', pdf.numPages, 'pages');

  const pageOrder = [pdf.numPages];
  if (pdf.numPages > 1) pageOrder.push(1);
  for (let i = pdf.numPages - 1; i > 1; i--) pageOrder.push(i);

  for (const pageNum of pageOrder) {
    const page = await pdf.getPage(pageNum);
    for (const scale of [3.0, 4.0, 5.0, 2.0]) {
      console.log(`[SDK] Scanning page ${pageNum} at scale ${scale}...`);
      const qr = await scanPageForQR(page, scale);
      if (qr) {
        console.log(`[SDK] QR found on page ${pageNum} at scale ${scale}`);
        return qr;
      }
    }
  }
  throw new Error(`No ${format} found`);
};


const scanFilesForQr = async (selectedFile) => {
  let scanResult = { data: null, error: null };
  const format = "QRCode";

  try {
    const fileType = selectedFile.type;

    if (fileType === "application/pdf") {
      const qrResult = await readQRcodeFromPdf(selectedFile, format);
      scanResult.data = qrResult;

    } else {
      const qrResult = await readQRcodeFromImageFile(selectedFile, format);
      scanResult.data = qrResult;
    }
  } catch (e) {
    if (e?.name === "InvalidPDFException") {
      scanResult.error = "Invalid PDF";
    } else if (e instanceof Event) {
      scanResult.error = "Invalid Image";
    } else {
      scanResult.error = "Unknown error: " + e;
    }
  }

  return scanResult;
};


const UploadFileSizeLimits = {
  min: 1000,
  max: 7000000
};

const getFileExtension = (fileName) =>
  fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();

const doFileChecks = (file, name) => {
  if (!file) return false;
  const { min, max } = UploadFileSizeLimits;
  if (file.size < min || file.size > max) {
    return false;
  }
  const fileExtension = file.name ? getFileExtension(file.name) : 'error';
  const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'pdf'];
  return validExtensions.includes(fileExtension);
};


const decodeQrData = async (qrData) => {
  if (!!!qrData) return;
  let encodedData = qrData;

  if (!!HEADER_DELIMITER) {
    const splitQrData = qrData.split(HEADER_DELIMITER);
    const header = splitQrData[0];

    if (SUPPORTED_QR_HEADERS.indexOf(header) === -1) return;
    if (splitQrData.length !== 2) return;

    encodedData = splitQrData[1];

  }
  let decodedData = new TextDecoder("utf-8").decode(encodedData);
  if (decodedData.startsWith(ZIP_HEADER)) {
    return await decodeBinary(encodedData);
  }
  return decode(decodedData);
};


async function fetchData(resource) {
  try {
    const response = await fetch(resource);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data.credential;
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

async function apicheck(credential, url) {
  try {
    const response = await fetch(`${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: credential
    });

    const result = await response.json();
    return {
      result: result.verificationStatus,
      credential
    };
    
  } catch (error) {

    return error;
  }
}
export async function vcVerification(file, url) {
  const isFileValid = doFileChecks(file);
  // if (!isFileValid) {
  //   return {
  //     "status": "FAILURE",
  //     "data": {},
  //     "error": "Invalid file type"
  //   };
  // }
  let scanResult = await scanFilesForQr(file);
  if (scanResult.error) {
    return {
      "status": "FAILURE",
      "data": {},
      "error": scanResult.error
    };
  }
  console.log(scanResult.data);
  return vcQrCodeVerification(scanResult.data, url)
}

export async function vcQrCodeVerification(qrData, url) {
  let credential = {};
  try {
    if (qrData.startsWith("INJI_OVP://")) {
      const ovpURL = qrData.replace(/^INJI_OVP:\/\//, '');
      const urlObject = new URL(ovpURL);
      const resource = (urlObject.searchParams.get('resource'));
      credential = await fetchData(resource);
    } else {
      const uint8Array = fromString(qrData, "utf8");
      credential = JSON.parse(await decodeQrData(uint8Array));
    }
    const finaldata = await apicheck(JSON.stringify(credential), url)
    
    const data = {
      "status": "SUCCESS",
      data: finaldata,
      error: ""
    }
    console.log(data);
    return data
  } catch (e) {
    const data = {
      "status": "FAILURE",
      data: {},
      error: JSON.stringify(e)
    }
    console.log(data);
    return data
  }
}



