# inji-verify-sdk

SDK for verifying credentials using QR codes from image and PDF files.
## Features

- **Upload**: Upload image or PDF files for QR code verification.
- **Scan**: Scan and decode QR codes directly from images or PDFs, then post the decoded data to a verification API.

---

📤 File Upload Support
Upload and scan files of the following types:

🖼️ Images: PNG, JPG, JPEG, GIF

📄 Documents: PDF (multi-page supported)

## 📆 Installation

```bash
npm install inji-verify-sdk
```

---

## 🚀 Usage

```js
import {vcVerification} from 'inji-verify-sdk';

// Example usage:
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  const url = 'https://xyzcom/v1/verify/vc-verification';

  const result = await VCverification(file, url);
  console.log(result);
});
```

---

## 💠 API

### `VCverification(file: File, url: API URL): Promise<object | string | null>`

| Parameter | Type   | Required | Description                                             |
|----------|--------|----------|---------------------------------------------------------|
| `file`   | File   | ✅       | The file to be upload (image or PDF).                 |
| `url`    | string | ✅       | The verification API endpoint to which data is posted. |


---

## 🧪 Example Response

```js
{
  "result": {
    "verificationStatus": "SUCCESS"
  },
  "credential": {
    "credentialSubject": {
      "studentId": "123",
      "major": "EEE",
      "graduationDate": "2025-01-01",
      "studentName": "xyz",
      "degree": "BE",
      "UIN": "123",
      "type": "GraduationCredential"
    },
    "issuanceDate": "2025-04-03T14:50:46.938Z",
    "id": "https://mosip.io/credential/6bf2eefa-88c8-4078-ac6c-fd0eec8cbd8e",
    "type": [
      "VerifiableCredential",
      "GraduationCredential"
    ],
    "issuer": "did:web:tejash-jl.github.io:DID-Resolve:utt"
  }
}

```

If verification fails:

```js
{
    "credential": {},
    "result": {
        "verificationStatus": "INVALID"
    },
    "error": "failed"
}
```



## 📁 Supported File Types

- JPEG, PNG, JPG, GIF
- PDF (with QR on pages)

---
## 🚀 Usage

```js
import {vcQrCodeVerification} from 'inji-verify-sdk';


  const scannedText = '...'; // String value from QR scanner
  const result = await vcQrCodeVerification(
    scannedText,
    'https://xyzcom/v1/verify/vc-verification'
  );
  console.log(result);
  
```
## 💠 API

VCverificationScanQrcode(data: string, url: API URL): Promise<object | null>
Verifies a Verifiable Credential directly from a QR code text string.


| Parameter | Type   | Required | Description                                         |
|-----------|--------|----------|-----------------------------------------------------|
| `data`    | string | ✅       | The decoded QR code string (UTF-8).                 |
| `url`     | string | ✅       | The verification API endpoint to post the data to.  |

## 🧪 Example Response

```js
{
  "result": {
    "verificationStatus": "SUCCESS"
  },
  "credential": {
    "credentialSubject": {
      "studentId": "123",
      "major": "EEE",
      "graduationDate": "2025-01-01",
      "studentName": "xyz",
      "degree": "BE",
      "UIN": "123",
      "type": "GraduationCredential"
    },
    "issuanceDate": "2025-04-03T14:50:46.938Z",
    "id": "https://mosip.io/credential/6bf2eefa-88c8-4078-ac6c-fd0eec8cbd8e",
    "type": [
      "VerifiableCredential",
      "GraduationCredential"
    ],
    "issuer": "did:web:tejash-jl.github.io:DID-Resolve:utt"
  }
}

```If verification fails:

```js
{
    "credential": {},
    "result": "INVALID"
}
```



### Key Update:
- **Integrated with Laravel**: A note has been added under the **"Integrated with Laravel"** section, mentioning that the library is already integrated into a Laravel project for QR code scanning and credential verification.


3. **GitHub Repository**: https://github.com/pkumarmshetty/VCverification


This guide helps users integrate and use the `inji-verify-sdk` in a Laravel project, both for file uploads and QR code scanning functionalities.

## 📃 License

MPL-2.0 license 

