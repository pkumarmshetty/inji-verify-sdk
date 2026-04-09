

import { fromString } from 'uint8arrays/from-string';
import { decode, decodeBinary } from "@mosip/pixelpass";
import * as pdfjsLib from "pdfjs-dist";
import jsQR from 'jsqr';

//  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs";

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
  // Force alpha to 255 (opaque) - PDF.js can render transparent pixels
  for (let i = 3; i < imageData.data.length; i += 4) {
    imageData.data[i] = 255;
  }
  // Try multiple binarization thresholds
  const thresholds = [128, 100, 160, 80];
  for (const threshold of thresholds) {
    const binaryData = new Uint8ClampedArray(imageData.data.length);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const gray = 0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2];
      const val = gray > threshold ? 255 : 0;
      binaryData[i] = val;
      binaryData[i + 1] = val;
      binaryData[i + 2] = val;
      binaryData[i + 3] = 255;
    }
    const result = jsQR(binaryData, canvas.width, canvas.height);
    if (result) return result.data;
  }
  // Try inverted colors
  const inverted = new Uint8ClampedArray(imageData.data.length);
  for (let i = 0; i < imageData.data.length; i += 4) {
    inverted[i] = 255 - imageData.data[i];
    inverted[i + 1] = 255 - imageData.data[i + 1];
    inverted[i + 2] = 255 - imageData.data[i + 2];
    inverted[i + 3] = 255;
  }
  const invertedResult = jsQR(inverted, canvas.width, canvas.height);
  return invertedResult ? invertedResult.data : null;
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
    { x: w * 0.6, y: h * 0.7, w: w * 0.4, h: h * 0.3 },   // bottom-right
    { x: w * 0.5, y: h * 0.5, w: w * 0.5, h: h * 0.5 },   // right-center to bottom
    { x: w * 0.65, y: h * 0.75, w: w * 0.35, h: h * 0.25 }, // tight bottom-right
    { x: 0, y: h * 0.5, w: w, h: h * 0.5 },                 // bottom half
    { x: w * 0.5, y: 0, w: w * 0.5, h: h * 0.5 },           // top-right
    { x: 0, y: 0, w: w, h: h },                              // full page
  ];
  for (const r of regions) {
    const result = cropAndScan(canvas, Math.floor(r.x), Math.floor(r.y), Math.floor(r.w), Math.floor(r.h));
    if (result) return result;
  }
  return null;
};

const readQRcodeFromPdf = async (file, format) => {
  const pdfData = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  const numPages = pdf.numPages;

  // Scan last page first (common for WeLearnTT), then first page, then rest
  const pageOrder = [...new Set([numPages, 1, ...Array.from({ length: numPages - 2 }, (_, i) => i + 2)])];
  const scales = [3.0, 4.0, 2.0];

  for (const pageNum of pageOrder) {
    const page = await pdf.getPage(pageNum);
    for (const scale of scales) {
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      // Fill white background before rendering (critical for QR detection)
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;

      const qrCode = scanPageRegions(canvas);
      if (qrCode) return qrCode;
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



