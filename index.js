#!/usr/bin/env node

// arg 1: desired output height (in pixels), OR PRODUCT TYPE (options: shirt, sweatshirt)
// arg 2: NAME OF JSON FILE INCLUDED IN THE data/json/ directory. example: 33357_1.json
// arg 3: output file name (optional)

// sweatshirt height starting point = 2460 px
// t shirt height starting point = 2255 px

//process.env.FC_DEBUG = 8191;
process.env.PANGOCAIRO_BACKEND = 'fontconfig'
process.env.FONTCONFIG_PATH = require('path').resolve(__dirname, './assets/fonts')

const fs = require('fs');
const queryString = require('querystring');
const JSDOM = require('jsdom').JSDOM;
const request = require('request');
const imageUrl = require('./modules/imageurl');
const pbcopy = require('./modules/utils/pbcopy');

// GLOBALS AND SETUP

global.dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = global.dom.window;
global.document = global.window.document;
global.Canvas = require('canvas');
global.Image = require('canvas').Image;
window.CanvasRenderingContext2D = 'foo'; // needed ?
global.window.Element = undefined; // needed ?
global.navigator = global.window.navigator = { userAgent: 'node.js' };
global.window.DOMParser = require('xmldom').DOMParser;
global.PIXI = require('pixi.js');

global.PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

const _overlay = false;

let newSize = process.argv[2] || 2255;
if (newSize == 'shirt') {newSize = 2255}
if (newSize == 'sweatshirt') {newSize = 2460}

const jsonFile = process.argv[3] || '33357_1.json';
// const exampleData = require('./data/' + jsonFile );

const jsonFiles = [
  "33357_1.json",
  "33413_1.json",
  "33415_1.json",
  "33425_1.json",
  "33515_1.json",
  "33711_1.json",
  "33735_4.json",
  "33830_1.json"
]

// const exampleDataJson = fs.readFileSync("./data/json/" + jsonFile);
// const exampleData = JSON.parse(exampleDataJson);

// commented out to work on server
// const exampleData = require('./data/json/' + jsonFile)

const exampleData = require(jsonFile)
const data = exampleData.pixi;
const outputFileName = jsonFile.slice(jsonFile.lastIndexOf('/') + 1, jsonFile.lastIndexOf('.')) + '-' + newSize.toString() + 'px.png'
const outputFilePath = process.argv[4] || './output_images/prints/sweatshirt_sized/' + outputFileName
const app = new PIXI.Application(newSize * data.width/data.height, newSize, {
    backgroundColor: 0xffffff
});
// const app = new PIXI.Application(newSize, newSize, {
//     backgroundColor: 0xffffff
// });
const bkg = new PIXI.Container();
app.stage.addChild(bkg);
const container = new PIXI.Container();
app.stage.addChild(container);
let spritecounter = 0;

// FONT TEST FROM TUTORIAL
// function createFontCanvas(fontname) {
//   const canvas = new Canvas(640, 480)
//   const ctx = canvas.getContext('2d')
//
//   // '700' and 'bold' are bold; '400' is normal, '900' is extra-bold.
//   // See node-canvas's Canvas::GetWeightFromCSSString()
//   // https://github.com/Automattic/node-canvas/blob/62dc1b59c551d1606572b324e6bfc0e099a72d0e/src/Canvas.cc#L731-L760
//   const Weight = '900'
//
//   // 'italic' and 'oblique' are the two other options
//   // See node-canvas's Canvas::GetStyleFromCSSString()
//   // https://github.com/Automattic/node-canvas/blob/62dc1b59c551d1606572b324e6bfc0e099a72d0e/src/Canvas.cc#L712-L725
//   const Style = 'normal'
//
//   // Use `fc-match` command-line tool to test this finds your font
//   // FONTCONFIG_PATH=./fonts fc-match "Proxima Nova Condensed"
//   const FontFamily = fontname
//
//   const FontSize = 30 // px font size, even if you specify "pt"
//
//   ctx.fillStyle = 'black'
//   ctx._setFont(Weight, Style, FontSize, 'px', FontFamily)
//   ctx.fillText("Hello, World!", 50, 50)
//
//   require('fs').writeFileSync('output_images/hello-world.png', canvas.toDataURL().split(",")[1], 'base64');
// }
// createFontCanvas('CormorantGaramond-Medium'); // test from font tutorial

// FUNCTIONS AND CALLBACKS

scaleAndAddChildren = (sprite, child, newScale) => {
  // APPLIES WHETHER IMAGE OR TEXT SPRITE

  // Set the sprite position to the center of container
  sprite.anchor.set(0.5);
  sprite.x = child.position.x * newScale;
  sprite.y = child.position.y * newScale;

  // Set scale and rotation of the sprite
  if (child.texture && child.pluginName != 'tilingSprite') { // if it's a non-tiled image (fontSize handled separately)
    sprite.scale.x = child.scale.x * newScale;
    sprite.scale.y = child.scale.y * newScale;
  }

  sprite.rotation = child.rotation;

  // to maintain order, since pixi doesn't have z-index.
  // after all async child calls are complete (image loading etc), loop through children sprites again in order
  child.newSprite = sprite;

  spritecounter++;

  if (spritecounter == data.children.length) {
    for (let i = 0; i < data.children.length; i++) {
      container.addChild(data.children[i].newSprite);
    }

    if (_overlay) {
      // add in overlay
      const editedURL = data.overlay.texture.indexOf('filepicker') ? data.overlay.texture : data.overlay.texture.slice(0, data.overlay.texture.lastIndexOf('?'))
      request({url: editedURL, qs: {}, encoding: null}, (err, res, body) => { // important: must have encoding null
        if (err) console.log(err);

        let imgdata = "data:" + res.headers["content-type"] + ";base64," + new Buffer(body).toString('base64');
        sprite = PIXI.Sprite.fromImage(imgdata); // overlay
        sprite.scale.x = data.overlay.size.width / 600 * newScale;
        sprite.scale.y = data.overlay.size.height / 600 * newScale;
        sprite.opacity = .5;
        sprite.anchor.set(.5);
        sprite.position.x = data.width * newScale / 2
        sprite.position.y = data.height * newScale / 2
        container.addChild(sprite)

        finishRendering();
      });
    }
    else {
      finishRendering();
    }
  };
}



makeTilingSprite = (child, imagedata) => {
  let newScale = newSize / data.height;

  // create new canvas with imagedata and resize it to smaller scale before applying tilingsprite
  const canvas = document.createElement('canvas')
  const img = new Image()
  const ctx = canvas.getContext('2d')
  img.src = imagedata
  const newWidth = (img.width/img.height)*600*newScale*child.scale.x
  const newHeight =(img.height/img.width)*600*newScale*child.scale.y
  canvas.width = newWidth
  canvas.height = newHeight
  ctx.drawImage(img, 0, 0, newWidth, newHeight)

  const texture = PIXI.Texture.fromCanvas(canvas);

  const sprite = new PIXI.extras.TilingSprite(
    texture,
    app.renderer.width * 4,
    app.renderer.height * 4,
  );

  return sprite;
}

addBackground = () => {
  const background = data.background;
  if (background.value1) {

    const col = parseInt(
      background.value1.substring(1),
      16,
    );

    if (!background.gradient) { // solid color background
      const graphics = new PIXI.Graphics();
      graphics.beginFill(col);
      graphics.drawRect(0, 0, app.renderer.width, app.renderer.height);
      graphics.zIndex = -2;
      bkg.addChild(graphics);
    } else { // if there is a gradient
      const c = document.createElement('canvas');
      c.width = app.renderer.width;
      c.height = app.renderer.height;

      const ctx = c.getContext('2d');
      const w = app.renderer.width;
      const h = app.renderer.height;

      const scale = 1 - background.scale_gradient || 1;
      const rotate = background.rotate_gradient / 360 * 2 * Math.PI || 0;
      const translate = h * Number(background.translate_gradient) - h / 2 || 0;

      const grd = ctx.createLinearGradient(
        w / 2 - scale * w / 2 * Math.cos(rotate) + translate * Math.cos(rotate),
        h / 2 - scale * h / 2 * Math.sin(rotate) + translate * Math.sin(rotate),
        w / 2 + scale * w / 2 * Math.cos(rotate) + translate * Math.cos(rotate),
        h / 2 + scale * h / 2 * Math.sin(rotate) + translate * Math.sin(rotate)
      );
      grd.addColorStop(0, background.value1 || '#ffffff');
      grd.addColorStop(1, background.value2 || '#000000');

      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, app.renderer.width, app.renderer.height);

      const gradientSprite = new PIXI.Sprite(PIXI.Texture.fromCanvas(c));

      bkg.addChild(gradientSprite);

    }
  }
}

finishRendering = () => {
  setTimeout(() => {
    var canvasdata = app.view.toDataURL().split(",")[1];
    fs.writeFile(outputFilePath, canvasdata, 'base64', (err) => {
        if (err) console.log(err);
        console.log('data saved!');
        console.log(outputFilePath)
        process.exit();
    });
  }, 200); // TODO remove sync. not sure why this only works with a timeout, maybe something in pixi code?
}

createPixiApp = () => {

  let newScale = newSize / data.height;

  data.background && addBackground();

  for (let i = 0; i < data.children.length; i++) {
    const child = data.children[i];

    if (child.pluginName === 'sprite' || child.pluginName === 'tilingSprite') {
      let sprite;

      ///////////// 1. IF IT IS AN IMAGE //////////////
      if (child.texture) {

        const base_url = child.texture;
        const last_index = base_url.lastIndexOf('?')
        // const cleaned_url = base_url.slice(0,last_index)
        let cleaned_url = data.overlay.texture.indexOf('filepicker') ? base_url : base_url.slice(0,last_index)
        // TODO remove webp, if we accept the filepicker urls like this
        cleaned_url = cleaned_url.replace(/outputFormat=webp/g, '')

        // queryParams = queryString.parse(new_url.replace(/^.*\?/, ''));
        // console.log('cleaned url: ' + cleaned_url)

        request({url: cleaned_url, qs: {}, encoding: null}, (err, res, body) => { // important: must have encoding null
          if (err) console.log(err);

          let data = "data:" + res.headers["content-type"] + ";base64," + new Buffer(body).toString('base64');
          // fs.writeFile('./output_images/requestoutput.png', data.split(',')[1], 'base64', (err) => {if (err) console.log(err)});

          if (child.pluginName == 'sprite') {
            sprite = PIXI.Sprite.fromImage(data);
            if (base_url.indexOf('height=600') && sprite.height > 600) { // this init resizing only needed for sprite not tilingSprite
              child.scale.y *= 600 / sprite.height // scale the child's height by what is necessary to make it 600 as a starting point
              child.scale.x *= 600 / sprite.height
            }
          }
          else if (child.pluginName == 'tilingSprite') {
            sprite = makeTilingSprite(child, data);
          }

          scaleAndAddChildren(sprite, child, newScale, i);
        });
      }
      ///////////// 2. IF IT IS TEXT //////////////
      else {
        const style = child.style;
        style.fontSize *= newScale;
        // if (style.fontStyle == 'italic') {
        //   style.fontFamily = 'Roboto-Italic' // TODO this may not always work ! ! !
        //   console.warn('WARNING: contains italic font, check if it works')
        // }
        console.log(style.fontStyle)
        
        sprite = new PIXI.Text(child.text, style);
        scaleAndAddChildren(sprite, child, newScale, i);
      }
    }
  }
}

createPixiApp()
