'use strict';

const config = require('config');
const async = require('async');
const CronJob = require('cron').CronJob;
const Twit = require('twit');
const rg = require('rangen');
const request = require('request').defaults({ encoding: null });
// const Rx = require('rx');

let Bot = new Twit({
  consumer_key: config.TWITTER_CONSUMER_KEY,
  consumer_secret: config.TWITTER_CONSUMER_SECRET,
  access_token: config.TWITTER_ACCESS_TOKEN,
  access_token_secret: config.TWITTER_ACCESS_TOKEN_SECRET
});

new CronJob('0 */55 * * * *', createTweet, null, true, 'America/Los_Angeles');

let photos = [];

function createTweet() {
  async.waterfall([
    getPhoto,
    generateStatus,
    createBuffer,
    uploadMedia,
    postTweet
  ], (err, result) => {
    if (err) {
      return console.error('tweet posting error', err);
    }
    console.log('tweet posted on: ', new Date());
  });
}

function getPhoto(cb) {
  let options = {};
  if (photos.length) {
    options.image = photos[0];
    photos.splice(0, 1);
    if (!photos.length) {
      findPhotos();
    }
    return cb(null, options);
  }
  findPhotos();
  cb('no photos');
}

function findPhotos() {
  async.parallel([
    pxPopular,
    pxFresh,
  ], err => {
    if (err) {
      return console.error('find photos error', err);
    }
    photos = shuffle(photos);
    console.log(photos.length, 'received');
    if (photos.length < 26) {
      getMorePhotos();
    }
  });

  function pxPopular(cb) {
    rg.image({
      image_size: 4,
      feature: 'popular',
      tags: 1,
      rpp: 100
    }, (err, images) => {
      if (err) {
        return cb(err);
      }
      let imgs = filter(images);

      Array.prototype.push.apply(photos, imgs);
      cb(null);
    });
  }

  function pxFresh(cb) {
    rg.image({
      image_size: 4,
      feature: 'fresh_today',
      tags: 1,
      rpp: 100
    }, (err, images) => {
      if (err) {
        return cb(err);
      }
      let imgs = filter(images);

      Array.prototype.push.apply(photos, imgs);
      cb(null);
    });
  }

  function getMorePhotos() {
    console.log('get more photos');
  }
}

function generateStatus(options, cb) {
  let status = options.image.description;

  let tags = filterTags(options.image.tags);
  tags.forEach(t => {
    if ((status.length + t.length < 115) && (t.search(/&amp/i) === -1)) {
      status += ` #${t}`;
    }
  });

  if (status.length < 117 && options.image.camera) {
    if (status.length + options.image.camera < 115) {
      status += ` #${options.image.camera}`;
    }
  }

  options.status = status;
  cb(null, options);
}

function createBuffer(options, cb) {
  request.get(options.image.image_url, (error, response, body) => {
    if (error || response.statusCode !== 200) {
      return cb('createBuffer: error receiving remote image');
    }
    options.b64content = new Buffer(body).toString('base64');
    cb(null, options);
  });
}

function uploadMedia(options, cb) {
  Bot.post('media/upload', { media_data: options.b64content }, (err, data, response) => {
    if (err) {
      return cb(err);
    }
    options.mediaIdStr = data.media_id_string;
    cb(null, options);
  });
}

function postTweet(options, cb) {
  let status = options.status;
  if (status.length > 116) {
    status = status.substring(0, 116);
  }
  let params = {
    status,
    media_ids: [options.mediaIdStr]
  };
  Bot.post('statuses/update', params, (err, data, response) => {
    if (err) {
      return cb(err);
    }
    cb(null);
  });
}

function filter(images) {
  return images
    .filter(i => i.tags.length > 2)
    .filter(i => i.description && i.name)
    .filter(i => i.description.length > 10 && i.description.length < 90)
    .filter(i => i.name.length > 4 && i.name.length < 90)
    .filter(i => i.description.toLowerCase() !== 'untitled')
    .filter(i => i.name.toLowerCase() !== 'untitled')
    .filter(i => i.description.search(/.jpg/i) === -1)
    .filter(i => i.name.search(/.jpg/i) === -1)
    .filter(i => i.description.search(/http:/i) === -1)
    .filter(i => i.description.search(/https:/i) === -1)
    .filter(i => i.name.search(/russia/i) === -1)
    .filter(i => i.description.search(/russia/i) === -1);
}

function filterTags(tags) {
  return tags
    .filter(i => i.length > 1)
    .filter(i => i.search(/russia/i) === -1)
    .filter(i => i.search(/moscow/i) === -1);
}

function shuffle(o) {
  for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x); //eslint-disable-line
  return o;
}
