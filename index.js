#!/usr/bin/env node

process.env.FC_DEBUG = 8191;
process.env.PANGOCAIRO_BACKEND = 'fontconfig'
process.env.FONTCONFIG_PATH = require('path').resolve(__dirname, './assets/fonts')

const fs = require('fs');
const queryString = require('querystring');
const JSDOM = require('jsdom').JSDOM;
const request = require('request');
const imageUrl = require('./modules/imageurl');
const exampleData = require('./data/exampleData9');
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

const newSize = process.argv[2];
const data = process.argv[3] || exampleData.pixi;
const outputFileName = process.argv[4] || 'outputHeight-' + newSize.toString() + 'px.png';
const app = new PIXI.Application(newSize * data.width/data.height, newSize, {
    backgroundColor: 0xffffff
});
const bkg = new PIXI.Container();
app.stage.addChild(bkg);
const container = new PIXI.Container();
app.stage.addChild(container);
let spritecounter = 0;

// FONT TEST FROM TUTORIAL
function createFontCanvas(fontname) {
  const canvas = new Canvas(640, 480)
  const ctx = canvas.getContext('2d')

  // '700' and 'bold' are bold; '400' is normal, '900' is extra-bold.
  // See node-canvas's Canvas::GetWeightFromCSSString()
  // https://github.com/Automattic/node-canvas/blob/62dc1b59c551d1606572b324e6bfc0e099a72d0e/src/Canvas.cc#L731-L760
  const Weight = '900'

  // 'italic' and 'oblique' are the two other options
  // See node-canvas's Canvas::GetStyleFromCSSString()
  // https://github.com/Automattic/node-canvas/blob/62dc1b59c551d1606572b324e6bfc0e099a72d0e/src/Canvas.cc#L712-L725
  const Style = 'normal'

  // Use `fc-match` command-line tool to test this finds your font
  // FONTCONFIG_PATH=./fonts fc-match "Proxima Nova Condensed"
  const FontFamily = fontname

  const FontSize = 30 // px font size, even if you specify "pt"

  ctx.fillStyle = 'black'
  ctx._setFont(Weight, Style, FontSize, 'px', FontFamily)
  ctx.fillText("Hello, World!", 50, 50)

  require('fs').writeFileSync('output_images/hello-world.png', canvas.toDataURL().split(",")[1], 'base64');
}

// FONT TEST FROM TUTORIAL (creates a hello-world.png, should use the correct font)
// createFontCanvas('CormorantGaramond-Medium');

// FUNCTIONS AND CALLBACKS

scaleAndAddChildren = (sprite, child, newScale) => {
  // APPLIES WHETHER IMAGE OR TEXT SPRITE

  // Set the sprite position to the center of container
  sprite.anchor.set(0.5);
  sprite.x = child.position.x * newScale;
  sprite.y = child.position.y * newScale;

  // Set scale and rotation of the sprite
  if (!child.style && child.text.length == 0) { // if it's not text, since text is scaled by fontSize before this functionn is called. otherwise it gets blurry
    sprite.scale.x = child.scale.x * newScale; // TODO if the image gets scaled by 4x with a stretching service, divide by 4 also
    sprite.scale.y = child.scale.y * newScale; // TODO if the image gets scaled by 4x with a stretching service, divide by 4 also
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
    finishRendering();
  };
}

createPixiApp = () => {
  let newScale = app.renderer.height / data.height;

  for (let i = 0; i < data.children.length; i++) {
    const child = data.children[i];

    if (child.pluginName === 'sprite' || child.pluginName === 'tilingSprite') {
      let sprite;

      if (!child.style && child.text.length == 0) { // IF IT IS AN IMAGE

        if (child.texture.indexOf('?')) {
          child.texture = child.texture.split('?')[0];
        } // We're cutting away any query params here

        const base_url = child.texture;
        // const new_url = imageUrl(child.texture, 600);
        const new_url = base_url; // TODO temporary, commented out above. not sure how imageurl works, but we should account for images that were converted to 600px previously

        queryParams = queryString.parse(new_url.replace(/^.*\?/, ''));
        console.log(queryParams)

        request({url: base_url, qs: {height: queryParams.height}, encoding: null}, (err, res, body) => { // important: must have encoding null
          if (err) console.log(err);

          let data = "data:" + res.headers["content-type"] + ";base64," + new Buffer(body).toString('base64');

          fs.writeFile('./output_images/requestoutput.png', data.split(',')[1], 'base64', (err) => {if (err) console.log(err)});

          if (child.pluginName == 'sprite') {
            sprite = PIXI.Sprite.fromImage(data);
            // TODO THIS IS TO ACCOUNT FOR IMAGES THAT USED THE 600 QUERY TO SQUISH IT ORIGINALLY, MAYBE DOESNT APPLY TO ALL
            if (sprite.height > 600) { // if the original height of the image is more than 600
              child.scale.y = 600 / sprite.height // scale the child's height by what is necessary to make it 600 as a starting point
              child.scale.x = 600 / sprite.width // TODO maybe not quite 600, aspect ratio
            }
          }
          else if (child.pluginName == 'tilingSprite') {
            sprite = makeTilingSprite(child, data);
          }
          scaleAndAddChildren(sprite, child, newScale, i);
        });
      }
      else { // IF IT IS TEXT TODO fonts dont work yet, they are tricky in node-canvas
        const style = child.style;
        style.fontSize *= newScale;
        // TODO why does font get blurry if the image is small? its not blurry when image is large
        sprite = new PIXI.Text(child.text, style);
        scaleAndAddChildren(sprite, child, newScale, i);
      }
    }
  }
}

makeTilingSprite = (child, imagedata) => {

  let newScale = app.renderer.height / data.height;

  const texture = PIXI.Texture.fromImage(imagedata);

  const sprite = new PIXI.extras.TilingSprite(
    texture,
    app.renderer.width * 4 / (newScale*child.scale.x),
    app.renderer.height * 4 / (newScale*child.scale.y),
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
  data.background && addBackground();
  setTimeout(() => {
    var canvasdata = app.view.toDataURL().split(",")[1];
    fs.writeFile('./output_images/' + outputFileName, canvasdata, 'base64', (err) => {
        if (err) console.log(err);

        console.log('data saved!');
        process.exit();
    });
  }, 200); // TODO remove sync. not sure why this only works with a timeout, maybe something in pixi code?
}

createPixiApp();
