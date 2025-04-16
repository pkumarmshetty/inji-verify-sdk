# PixelPass

Pixelpass is a library which can do multiple things which are listed below,

- Given a data → `generateQRCode` → returns a QR Code.

- Given a JSON String → `generateQRData` → Gives back CBOR encoded data.

- Given a CBOR encoded data as byte array → `decode` → Gives back JSON String.
  
- Given data as byteArray → `decodeBinary` → Gives back JSON String.
    
- Given a JSON and Mapper → `getMappedData` → Gives back CBOR encoded data.

- Given a CBOR encoded data and Mapper → `decodeMappedData` → Gives back a JSON.

## Features

- Compresses the data using zlib compression of level 9.

- Encodes/ Decodes the data using base45.

- When the Data is JSON, it does the CBOR encode/decode to reduce size further.

- When JSON and a Mapper is given, it maps the JSON with Mapper and then does the CBOR encode/decode which further reduces the size of the data.

## Usage 
`npm i @mosip/pixelpass`

[npm](https://www.npmjs.com/package/@mosip/pixelpass)

## Example
Prerequisites
* [nodejs](https://nodejs.org/en/learn/getting-started/how-to-install-nodejs)
* [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)

To run the example app copy the below command and paste it to your terminal.

```
git clone https://github.com/mosip/pixelpass.git && cd pixelpass && git checkout develop && cd js && npm i && cd example && npm i && npm start
```

## APIs
### generateQRCode( data, ecc , header )

 - `data` - Data needs to be compressed and encoded.

 - `ecc` - Error Correction Level for the QR generated. defaults to `"L"`.

 - `header` - Data header need to be prepend to identify the encoded data. defaults to `""`.

```javascript
import { generateQRCode } from '@mosip/pixelpass';

const data = "Hello";
const qrCode = generateQRCode(data, ecc, header);

// ecc is Error Correction Level for the QR generated. defaults to "L".
// header defaults to empty string if not passed.
```
The `generateQRCode` takes a data, ECC (Error correction level) which when not passed defaults to L and header which defaults to empty string if not passed.
Returns a base64 encoded PNG image.

### generateQRData( data, header )

- `data` - Data needs to be compressed and encoded.

- `header` - Data header need to be prepend to identify the encoded data. defaults to `""`.

```javascript
import { generateQRData } from '@mosip/pixelpass';

const jsonString = "{\"name\":\"Steve\",\"id\":\"1\",\"l_name\":\"jobs\"}";
const header = "jsonstring";

const encodedCBORData = generateQRData(jsonString, header);

// header defaults to empty string if not passed.
```
The `generateQRData` takes a valid JSON string and a header which when not passed defaults to an empty string.
This API will return a base45 encoded string which is `Compressed > CBOR Encoded > Base45 Encoded`.


### decode( data )

- `data` - Data needs to be decoded and decompressed without header.

```javascript
import { decode } from '@mosip/pixelpass';

const b45EncodedData = "NCFWTL$PPB$PN$AWGAE%5UW5A%ADFAHR9 IE:GG6ZJJCL2.AJKAMHA100+8S.1";
const jsonString = decode(b45EncodedData);
```
The `decode` will take a `string`  as parameter and gives us decoded JSON string which is Base45 `Decoded > CBOR Decoded > Decompressed`.

### decodeBinary( data )

- `data` - Data needs to be decoded and decompressed without header.

```javascript
import { decodeBinary } from '@mosip/pixelpass';

const zipdata = <zip-byte-array>;
const decompressedData = decodeBinary(zipdata);
```
The `decodeBinary` will take a `UInt8ByteArray`  as parameter and gives us unzipped string. Currently only zip binary data is only supported.


### getMappedData( jsonData, mapper, cborEnable );

- `jsonData` - A JSON data.
- `mapper` - A Map which is used to map with the JSON.
- `cborEnable` - A Boolean which is used to enable or disable CBOR encoding on mapped data. Defaults to `false` if not provided.

```javascript
import { getMappedData } from '@mosip/pixelpass';

const jsonData = {"name": "Jhon", "id": "207", "l_name": "Honay"};
const mapper = {"id": "1", "name": "2", "l_name": "3"};

const byteBuffer = getMappedData(jsonData, mapper,true);

const cborEncodedString = byteBuffer.toString('hex');
```
The `getMappedData` takes 3 arguments a JSON and a map with which we will be creating a new map with keys and values mapped based on the mapper. The third parameter is an optional value to enable or disable CBOR encoding on the mapped data.  
The example of a converted map would look like, `{ "1": "207", "2": "Jhon", "3": "Honay"}`

### decodeMappedData( data, mapper )

- `data` - A CBOREncoded string or a mapped JSON.
- `mapper` - A Map which is used to map with the JSON.

```javascript
import { decodeMappedData } from '@mosip/pixelpass';

const cborEncodedString = "a302644a686f6e01633230370365486f6e6179";
const mapper = {"1": "id", "2": "name", "3": "l_name"};

const jsonData = decodeMappedData(cborEncodedString, mapper);
```

The `decodeMappedData` takes 2 arguments a string which is CBOR Encoded or a mapped JSON and a map with which we will be creating a JSON by mapping the keys and values. If the data provided is CBOR encoded string the API will do a CBOR decode first ad then proceed with re-mapping the data.
The example of the returned JSON would look like, `{"name": "Jhon", "id": "207", "l_name": "Honay"}`


## Errors / Exceptions
- `Cannot read properties of null (reading 'length')` - thrown when the string passed to encode is null.

- `Cannot read properties of undefined (reading 'length')` - thrown when the string passed to encode is undefined.

- `byteArrayArg is null or undefined.` -  thrown when the string passed to encode is null or undefined.

- `utf8StringArg is null or undefined.` - thrown when the string passed to decode is null or undefined.

- `utf8StringArg has incorrect length.` - thrown when the string passed to decode is of invalid length.

- `Invalid character at position X.` - thrown when the string passed to decode is invalid with an unknown character then base45 character set. Also denotes the invalid character position.

- `incorrect data check` - thrown when the string passed to decode is invalid.


## License
MPL-2.0
