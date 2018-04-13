#!/usr/bin/env node

const fs = require("pn/fs");
const svg2png = require("svg2png");

const size = process.argv[2] || 1200
const svg_path = process.argv[3] || './temp/sweatshirt_mapped.svg'
const img_path = process.argv[4] || '/temp/unnamed.jpg'

// ALEX TODO make sure absolute paths work correctly on server. Decide on correct file locations to be accessed from / to server

fs.readFile(svg_path, 'utf8')
    .then((data) => {

      data = data.replace(/unnamed\.jpg/g, 'file://' + __dirname + img_path)
      console.log('file://' + __dirname + img_path)
      const buffer = Buffer.from(data, 'utf8')

      return svg2png(buffer, {width: size, height: size})
    })
    .then(buffer => fs.writeFile("./temp/dest.png", buffer))
    .catch(e => console.error(e));
