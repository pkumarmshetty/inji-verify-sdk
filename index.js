

import { fromString } from 'uint8arrays/from-string';
import { decode, decodeBinary } from "@mosip/pixelpass";
import * as pdfjsLib from "https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.min.mjs";
import jsQR from 'jsqr';

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
const readQRcodeFromPdf = async (file, format) => {
  const pdfData = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;

  let result;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 3.0 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    await page.render(renderContext).promise;
    const dataURL = canvas.toDataURL();
    const blob = await (await fetch(dataURL)).blob();

    const qrCode = await readQRcodeFromImageFile(blob, format, true);

    if (qrCode) {
      result = qrCode;
    }
  }
  if (result) {
    return result;
  } else {
    throw new Error(`No ${format} found`);
  }
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
  min: 10000,
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
  ;
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

    if (result.verificationStatus === "SUCCESS") {
      return {
        result,
        credential
      };
    } else {
      return {
        credential: {},
        result: result.verificationStatus,
      }
    }
  } catch (error) {

    return error;
  }
}
export async function vcVerification(file, url) {
  const check = doFileChecks(file);
  const userURL = url;
  let scanResult = { data: null, error: null };

  scanResult = await scanFilesForQr(file);
  if (scanResult.error) {
    return null;
  }
  console.log(scanResult.data);
  if (check) {
    if (scanResult?.data.startsWith("INJI_OVP://https://")) {
      const urlString = scanResult.data.replace(/^INJI_OVP:\/\//, '');
      const url = new URL(urlString);
      const resource = (url.searchParams.get('resource'));
      const credential = await fetchData(resource);
      const finaldata = await apicheck(JSON.stringify(credential), userURL)
      const parsedData = JSON.parse(JSON.stringify(finaldata));
      const data = {
        credential: parsedData
      }
      console.log(data);
      return data
    } else {

      const uint8Array = fromString(scanResult.data, "utf8");
      const credential = await decodeQrData(uint8Array);
      const finaldata = await apicheck(credential, userURL);
      console.log(JSON.stringify(finaldata) + "actual output");
      const parsedData = JSON.parse(JSON.stringify(finaldata));
      const data = {
        credential: parsedData
      }
      return data

    }
  }

  return null;

}
export async function vcQrCodeVerification(file, url) {
  if (true) {
    const uint8Array = fromString(file, "utf8");
    const credential = await decodeQrData(uint8Array);
    const finaldata = await apicheck(credential, url);
    const parsedData = JSON.parse(JSON.stringify(finaldata));
    const data = {
      credential: parsedData
    }
    return data
  }
  return null;
}
