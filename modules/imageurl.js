const querystring = require('querystring');
const compactObject = require('./compactObject');

const PAOM_IMAGES_HOST = process.env.PAOM_IMAGES_HOST || 'https://images.paom.com';

function isGif(key) {
  return ['.gif'].indexOf(path.extname(key)) !== -1;
}

function isSvg(key) {
  return ['.svg'].indexOf(path.extname(key)) !== -1;
}

function mkPaomImagesUrl(bucketName) {
  return (key, size, device = {}) => {
    const query = querystring.stringify(
      compactObject({
        outputFormat: device.supportsWebP ? 'webp' : null,
        height: Math.floor(size || 0) || null,
      }),
    );

    return `${PAOM_IMAGES_HOST}/e${bucketName}/${key}?${query}`;
  };
}

const s3Urls = {
  paomdev: mkPaomImagesUrl('paomdev'),
  paome: mkPaomImagesUrl('paome'),
  paomview: mkPaomImagesUrl('paomview'),
  paomflat: mkPaomImagesUrl('paomflat'),
  paomeditorial: mkPaomImagesUrl('paomeditorial'),
  paomassets: mkPaomImagesUrl('paomassets'),
  paombody: mkPaomImagesUrl('paombody'),
  paomfp: mkPaomImagesUrl('paomfp'),
};

const s3UrlGroups = Object.keys(s3Urls).join('|');
const prefixedRe = new RegExp(
  '^https?://(' + s3UrlGroups + ').s3.amazonaws.com/(.+)$',
);
const postfixedRe = new RegExp(
  '^https?://s3.amazonaws.com/(' + s3UrlGroups + ')/(.+)$',
);

const imagesRe = /^(https?:)?\/\/images.paom.com(.+)$/;

function cdnUrl(targetUrl, size, device) {
  if (typeof targetUrl !== 'string') return targetUrl;
  const s3match = prefixedRe.exec(targetUrl) || postfixedRe.exec(targetUrl);

  // If the URL is an S3 website URL
  if (s3match) {
    const bucket = s3match[1];
    const path = s3match[2];

    if (isFunction(s3Urls[bucket])) {
      return s3Urls[bucket](path, size, device);
    }

    return s3Urls[bucket] + '/' + path;
  }

  // If the URL is newsletter.printallover.me
  if (targetUrl.indexOf('http://newsletter.printallover.me') === 0) {
    const prefixLength = 'http://newsletter.printallover.me'.length;
    const key = targetUrl.slice(prefixLength);
    return mkPaomImagesUrl('newsletter')(key, size);
  }

  // If the URL is images.paom.com
  const imagesMatch = imagesRe.exec(targetUrl);
  if (imagesMatch) {
    const path = imagesMatch[2];
    const query = querystring.stringify(
      compactObject({
        // outputFormat: device.supportsWebP ? 'webp' : null,
        outputFormat: 'webp',
        height: Math.floor(size || 0) || null,
      }),
    );
    return `${PAOM_IMAGES_HOST}${path}?${query}`;
  }

  // Just give up if we aren't in production
  if (process.env.NODE_ENV !== 'production') return targetUrl;

  // Use arbitrary URLs in images.paom.com
  const query = querystring.stringify(
    compactObject({
      outputFormat: device.supportsWebP ? 'webp' : null,
      url: targetUrl,
      height: Math.floor(size || 0) || null,
    }),
  );
  return `${PAOM_IMAGES_HOST}/arbitrary?${query}`;
}

function imageUrl(targetUrl, height, device) {
  // if (process.env.IS_BROWSER && !device) {
  //   device = {
  //     supportsWebP: require('supports-webp'),
  //   };
  // }

  if (typeof targetUrl !== 'string') return targetUrl;

  // if (isGif(targetUrl) || isSvg(targetUrl)) { // AEZ -- HAD TO COMMENT THIS OUT FOR IT TO WORK
  //   return targetUrl;
  // }

  if (targetUrl.indexOf('http://i.embed.ly/') === 0 && height) {
    const purl = url.parse(targetUrl);
    const pquery = querystring.parse(purl.query);
    pquery.height = height;
    return `http://i.embed.ly${purl.pathname}?${querystring.stringify(pquery)}`;
  }

  return cdnUrl(targetUrl, height, device);
}

module.exports = imageUrl;
