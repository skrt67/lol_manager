const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const regex = /splash\/(.+)_0\.jpg/g;
let match;
while ((match = regex.exec(code)) !== null) {
  console.log(match[0]);
}

const regex2 = /champion\/(.+)\.png/g;
while ((match = regex2.exec(code)) !== null) {
    console.log(match[0]);
}
