# Description
Simple base45 (charset of Qr codes, alphanumeric mode) encoder/decoder, which works seamlessly in browsers.

# Install
```
npm i base45-web
```

# Test
Run as 'npm test' to get an idea of what it does.

# Usage
```
const b45 = require("base45-js");

const e = b45.encode(Buffer.from('Hello!','utf-8'))
console.log(e); // Will output %69 VD92EX0"

const d = b45.decode('%69 VD92EX0')
console.log(d); // will output '[72, 101, 108, 108, 111, 33, 33]'

const d = b45.decodeToUtf8String('%69 VD92EX0')
console.log(d); // will output 'Hello!'
```

# Fork notes

## Reason
needed to do a npm release and to fix the typings

## Histroy:
Forked from https://github.com/ehn-dcc-development/base45-js which forked from https://github.com/dirkx/base45-js all credits goes to them!
