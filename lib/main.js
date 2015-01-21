'use strict';

var url = require('url');
var crypto = require('crypto');
var R = require('ramda');

var Wreck = require('wreck');

var config = null;
var uris = {};

module.exports = {
  config: configure,
  verifyUser: verifyUser,
  verifyTransaction: verifyTransaction,
  SUPPORTED_MODULES: ['idVerifier'],
  NAME: 'IdentityMind'
};

function configure(localConfig) {
  config = localConfig;
  uris.buyUri = buildUri('im/account/transferin');
  uris.sellUri = buildUri('im/account/transferout');
  uris.createAccountUri = buildUri('im/account/creation');
}

function buildUri(pathname) {
 return url.format({
    protocol: 'https',
    host: config.host,
    pathname: pathname
  });
}

function stage1Verify(data, cb) {
  var tid = data.tid || data.man.substr(0, 32);
  var newData = R.assoc('tid', tid, data);

  _request('POST', uris.createAccountUri, newData, function (err, res) {
    if (err) return cb(err);
    if (res.error_message) return cb(new Error(res.error_message));
    var success = res.state === 'A';
    var idResult = {success: success};
    cb(null, idResult);
  });
}

function verifyUser(rawData, cb) {
  var data = _normalizeData(rawData);
  var tid = data.tid || data.man.substr(0, 32);
  var quickCheckUri = uris.createAccountUri + '/' + tid;
  _request('GET', quickCheckUri, null, function (err, res) {
    if (err) return cb(err);
    var success = res.state === 'A';
    if (success) return cb(null, {success: true});
    stage1Verify(data, cb);
  });
}

function verifyTransaction(rawData, cb) {
  var data = _normalizeData(rawData);
  var buyOrSell = rawData.transaction.buyOrSell;
  var uri = buyOrSell === 'sell' ? uris.sellUri : uris.buyUri;
  _request('POST', uri, data, function (err, res) {
    if (err) return cb(err);
    if (res.error_message) return cb(new Error(res.error_message));
    var success = res.res === 'ACCEPT';
    var idResult = {success: success};
    cb(null, idResult);
  });
}

// Normalizes from Rakia standard
function _normalizeData(rawData) {
  var license = rawData.license;

  // Source format is YYYMMDD
  var dob = license.dateOfBirth.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');

  var man = license.uid.substr(0, 60);

  var country = license.country;
  if (country === 'USA') country = 'US';
  if (country === 'CAN') country = 'CA';

  var data = {
    bfn: license.firstName,
    bln: license.lastName,
    dob: dob,
    bsn: license.address,
    bc: license.city,
    bs: license.state,
    bz: license.postalCode,
    bco: country,
    man: man,
    stage: 1
  };

  if (rawData.licenseCode) {

    // Pad with zeros
    var paddedCode = String('0000' + rawData.licenseCode).slice(-4);

    data.assnl4 = paddedCode;
  }

  if (rawData.transaction) {
    var transaction = rawData.transaction;
    data.amt = transaction.fiat;
    data.ccy = transaction.currencyCode;
    if (transaction.toAddress)
      data.pbc = bitcoinAddressHash(transaction.toAddress);
  }

  if (rawData.scanData) {
    data.scanData = rawData.scanData;
    data.stage = 2;
  }

  if (rawData.tid) data.tid = rawData.tid;
  if (rawData.stage) data.stage = rawData.stage;

  return data;
}

function _basicAuthHeader(username, password) {
  return 'Basic ' + new Buffer(username + ':' + password).toString('base64');
}

// TODO check fields for length, etc
// TODO retry on network failure
function _request(method, uri, data, cb) {
  var username = config.username;
  var password = config.password;
  var auth = _basicAuthHeader(username, password);
  var options = {
    timeout: 20000,
    rejectUnauthorized: true,
    payload: JSON.stringify(data),
    headers: {
      'content-type': 'application/json',
      'authorization': auth
    },
    json: true
  };

  var wreck;
  if (method === 'GET') { wreck = Wreck.get; }
  if (method === 'POST') { wreck = Wreck.post; }
  if (!wreck) { throw new Error('Unsupported HTTP method'); }

  wreck(uri, options, function(err, res, payload) {
    cb(err, payload);
  });
}

function bitcoinAddressHash(address) {
  var saltedAddress = config.salt + address;
  return crypto.createHash('sha1').update(saltedAddress).digest('hex');
}
