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

new CronJob('0 */21 * * * *', createFreshTweet, null, true, 'America/Los_Angeles');
// new CronJob('0 */17 * * * *', createPopularTweet, null, true, 'America/Los_Angeles');

// function createPopularTweet() {
//   async.waterfall([
//     getPopularPhoto,
//     generateStatus,
//     createBuffer,
//     uploadMedia,
//     postTweet
//   ], (err, result) => {
//     if (err) {
//       return console.error('popular image tweet error', err);
//     }
//     console.log('popular image tweet posted on: ', new Date());
//   });
// }

function createFreshTweet() {
  async.waterfall([
    getFreshPhoto,
    generateStatus,
    createBuffer,
    uploadMedia,
    postTweet
  ], (err, result) => {
    if (err) {
      return console.error('fresh image tweet error', err);
    }
    console.log('fresh image tweet posted on: ', new Date());
  });
}

function getFreshPhoto(cb) {
  let options = {};
  rg.image({
    image_size: 4,
    feature: 'fresh_today',
    tags: 1
  }, (err, images) => {
    if (err) {
      return cb(err);
    }
    let imgs = images
      .filter(i => i.tags.length > 2)
      .filter(i => i.description && i.name)
      .filter(i => i.description.length > 10 && i.description.length < 90)
      .filter(i => i.name.length > 4 && i.name.length < 90)
      .filter(i => i.description.toLowerCase() !== 'untitled')
      .filter(i => i.name.toLowerCase() !== 'untitled')
      .filter(i => i.description.search(/.jpg/i) === -1)
      .filter(i => i.name.search(/.jpg/i) === -1)
      .filter(i => i.description.search(/http:/i) === -1)
      .filter(i => i.description.search(/https:/i) === -1);

    if (!imgs.length) {
      return setTimeout(() => {
        console.log('fresh foto: trying more...');
        getFreshPhoto(cb);
      }, 5000);
    }
    options.image = imgs[0];
    cb(null, options);
  });
}

function generateStatus(options, cb) {
  let status = options.image.description;

  options.image.tags.forEach(t => {
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
  console.log('status.length: ', status.length);
  if (status.length > 116) {
    status = status.substring(0, 116);
  }
  console.log('status.length: ', status.length);
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
