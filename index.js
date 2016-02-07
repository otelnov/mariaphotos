'use strict';

const config = require('config');
const CronJob = require('cron').CronJob;
const Twit = require('twit');
const rg = require('rangen');
const request = require('request').defaults({ encoding: null });

let Bot = new Twit({
  consumer_key: config.TWITTER_CONSUMER_KEY,
  consumer_secret: config.TWITTER_CONSUMER_SECRET,
  access_token: config.TWITTER_ACCESS_TOKEN,
  access_token_secret: config.TWITTER_ACCESS_TOKEN_SECRET
});

new CronJob('*/30 * * * *', createTweet, null, true, 'America/Los_Angeles');

function createTweet() {
  console.log('start creating tweet');
  generateStatus((err, tweetData) => {
    if (err) {
      return console.error(err);
    }
    console.log('tweet data received');
    request.get(tweetData.url, (error, response, body) => {
      if (error || response.statusCode != 200) {
        console.error(error);
        return console.log('error receiving remote image');
      }
      let b64content = new Buffer(body).toString('base64');
      console.log('base64 ready');
      Bot.post('media/upload', { media_data: b64content }, (err, data, response) => {
        if (err) {
          return console.error(err);
        }
        console.log('base64 uploaded');
        let mediaIdStr = data.media_id_string;
        let params = {
          status: tweetData.status,
          media_ids: [mediaIdStr]
        };
        Bot.post('statuses/update', params, (err, data, response) => {
          if (err) {
            return console.error(err);
          }
          console.log('tweet created.');
        });
      });
    });
  });
}

function getFreshImage(cb) {
  let params = {
    image_size: 4,
    rpp: 1,
    feature: 'fresh_today',
    tags: 1
  };
  rg.image(params, (err, image) => {
    cb(err, {
      url: image[0].image_url,
      name: image[0].name,
      description: image[0].description,
      camera: image[0].camera,
      tags: image[0].tags
    });
  });
}

function generateStatus(cb) {
  getFreshImage((err, data) => {
    if (err) {
      console.log('error get fresh img');
      return console.error(err);
    }
    let status = '#photo';

    let hashes = '';
    if (data.tags.length) {
      hashes = data.tags.map(h => '#' + h).join(' ');
    } else {
      hashes = data.name.replace(/"/g, '').split(' ').map(h => {
        if (h.length < 3) {
          return;
        }
        if (h == 'Untitled' || h == 'untitled') {
          return;
        }
        return '#' + h;
      }).join(' ');
    }

    if (data.description) {
      status = data.description + ' ' + hashes;
    } else {
      status = data.name + ' ' + hashes;
    }

    if (data.camera) {
      status += ' #' + data.camera;
    }

    if (status.length > 140) {
      status = status.substring(0, 140 - 23);
    }

    cb(null, {
      url: data.url,
      status
    });
  });
}
