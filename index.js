require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
const dns = require('dns');
const url = require('url');

const mongoose = require('mongoose');
const { error } = require('console');

mongoose.connect(process.env.MONGO_URI, { });

let UrlRef;

const urlRefSchema = new mongoose.Schema({
  url: {type: mongoose.SchemaTypes.String, required: true, unique: true},
  shortUrl: {type: mongoose.SchemaTypes.Number, required: true, unique: true}
});

UrlRef = mongoose.model('UrlRef', urlRefSchema);

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/public', express.static(`${process.cwd()}/public`));


const searchUrl = (urlValue, done) =>{
  UrlRef.findOne({url: urlValue}).then(
    urlRecord => {
      done(null, urlRecord);
    }
  ).catch(e => done(e));
}

const searchRef = (refValue, done) =>{
  UrlRef.findOne({shortUrl: refValue}).then(
    urlRecord => {
      done(null, urlRecord);
    }
  ).catch(e => done(e));
}

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

app.get('/api/shorturl/:urlRef', (req, res, next)=>{
  try {
    const strUrlRef = req.params.urlRef;

    if(isNaN(strUrlRef) && !/[0-9]+/.test(strUrlRef.replace(/^0/g,''))){
      res.json({error: 'Invalid Url Reference'})
      return;
    }
    const numUrlRef = Number(strUrlRef);
    searchRef(numUrlRef, (err, urlRef) => {
      if (err){throw new error(err);}

      if(urlRef){
        res.redirect(urlRef.url);
        return;
      }

      res.json({error: 'no url has been registered to that reference id yet'});
      return;
    })

  } catch (error) {
    console.error(error);
    res.json({unhandledError: error.message});
    return;
  }

});

app.post('/api/shorturl', (req, res, next)=>{
  try {
    const inUrl = req.body.url;

    // Validate Url Format
    const parsedUrl = new url.URL(inUrl);
    if(
      parsedUrl.hostname !== null &&
      parsedUrl.protocol !== null &&
      parsedUrl.hostname.startsWith('http')){
      throw new Error('invalid url');
    } else {
      // validate Url in DNS
      dns.lookup(parsedUrl.hostname, {all: true}, (err, addresses)=>{
        if(err || addresses.length < 1){
          res.json({error: 'invalid url'});
          return;
        } else {
          searchUrl(inUrl, (err, urlRef) => {
            if(err){
              throw new Error('failed to search for instance of url');
            }

            if(urlRef){
              res.json({"original_url": urlRef.url, "short_url": urlRef.shortUrl});
              return;
            } else {
              let index;
          
              UrlRef.countDocuments({}).then(
                data => {
                  index = data + 1;
                  new UrlRef({url: inUrl, shortUrl: index}).save().then(
                    data => {
                      res.json({"original_url": data.url, "short_url": data.shortUrl});
                    }
                  ).catch(e=>{
                    throw new Error(`Failed to save new record. ${e}`);
                  });
                }
              ).catch(e => {
                throw new Error(`initial record count failed in DB. ${e}`)
              });
            }
          })
        }
      });
    }
  } catch (error) {
    console.error(error);
    return;
  }
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
