

import { fromString } from 'uint8arrays/from-string';
import { decode, decodeBinary } from "@mosip/pixelpass";
import * as pdfjsLib from "pdfjs-dist";
import jsQR from 'jsqr';
import { BrowserQRCodeReader } from '@zxing/library';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs";

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

const scanCanvasForQR = (canvas) => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;

  // Force alpha to 255 (opaque) - PDF.js renders transparent pixels
  for (let i = 3; i < data.length; i += 4) {
    data[i] = 255;
  }

  // Try raw jsQR first on original data
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

  // Try inverted colors (for white QR on colored background)
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

const cropAndScan = (srcCanvas, x, y, w, h) => {
  const crop = document.createElement('canvas');
  crop.width = w;
  crop.height = h;
  const ctx = crop.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(srcCanvas, x, y, w, h, 0, 0, w, h);
  return scanCanvasForQR(crop);
};

const scanPageRegions = (canvas) => {
  const w = canvas.width;
  const h = canvas.height;
  const regions = [
    // Bottom-right area (WeLearnTT banner ~55-70% height)
    [Math.floor(w * 0.6), Math.floor(h * 0.5), Math.floor(w * 0.4), Math.floor(h * 0.35)],
    // Right-center (UTT certificate QR ~35-60% height)
    [Math.floor(w * 0.55), Math.floor(h * 0.3), Math.floor(w * 0.45), Math.floor(h * 0.45)],
    // Bottom-right quadrant
    [Math.floor(w / 2), Math.floor(h / 2), Math.floor(w / 2), Math.floor(h / 2)],
    // Bottom half
    [0, Math.floor(h / 2), w, Math.floor(h / 2)],
    // Top-right quadrant
    [Math.floor(w / 2), 0, Math.floor(w / 2), Math.floor(h / 2)],
    // Full page
    [0, 0, w, h],
  ];
  for (const [rx, ry, rw, rh] of regions) {
    const result = cropAndScan(canvas, rx, ry, rw, rh);
    if (result) return result;
  }
  return null;
};

const readQRcodeFromPdf = async (file, format) => {
  const pdfData = await file.arrayBuffer();
  console.log('[SDK] PDF size:', pdfData.byteLength);
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  const numPages = pdf.numPages;
  console.log('[SDK] PDF pages:', numPages);

  // Build page order: last page first, then first page, then remaining
  const pageOrder = [numPages];
  if (numPages > 1) pageOrder.push(1);
  for (let i = numPages - 1; i > 1; i--) pageOrder.push(i);

  const scales = [3.0, 4.0, 2.0];
  const codeReader = new BrowserQRCodeReader();

  for (const pageNum of pageOrder) {
    try {
      const page = await pdf.getPage(pageNum);
      for (const scale of scales) {
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        console.log(`[SDK] Page ${pageNum} scale ${scale}: ${canvas.width}x${canvas.height}`);

        // Try jsQR with region cropping first (fast)
        const qrCode = scanPageRegions(canvas);
        if (qrCode) {
          console.log(`[SDK] QR FOUND (jsQR) on page ${pageNum} at scale ${scale}`);
          return qrCode;
        }

        // ZXing fallback on cropped regions (handles colored backgrounds better)
        try {
          const w = canvas.width;
          const h = canvas.height;
          // Try ZXing on specific regions
          const zxRegions = [
            [Math.floor(w * 0.5), Math.floor(h * 0.5), Math.floor(w * 0.5), Math.floor(h * 0.5)],  // bottom-right quadrant
            [Math.floor(w * 0.55), Math.floor(h * 0.3), Math.floor(w * 0.45), Math.floor(h * 0.45)], // right-center
            [0, 0, w, h], // full page
          ];
          for (const [rx, ry, rw, rh] of zxRegions) {
            try {
              const crop = document.createElement('canvas');
              crop.width = rw;
              crop.height = rh;
              const cropCtx = crop.getContext('2d');
              cropCtx.fillStyle = '#FFFFFF';
              cropCtx.fillRect(0, 0, rw, rh);
              cropCtx.drawImage(canvas, rx, ry, rw, rh, 0, 0, rw, rh);
              const dataUrl = crop.toDataURL('image/png');
              const decoded = await codeReader.decodeFromImageUrl(dataUrl);
              if (decoded && decoded.text) {
                console.log(`[SDK] QR FOUND (ZXing) on page ${pageNum} at scale ${scale}, region [${rx},${ry}]`);
                return decoded.text;
              }
            } catch (e) { /* region failed */ }
          }
        } catch (zxErr) {
          // ZXing didn't find QR on this page/scale
        }
      }
    } catch (pageErr) {
      console.error(`[SDK] Error on page ${pageNum}:`, pageErr);
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



