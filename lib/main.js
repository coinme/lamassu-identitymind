'use strict';

var url = require('url');
var crypto = require('crypto');
var Wreck = require('wreck');

var config = null;
var uris = {};

module.exports = {
  init: init,
  verifyUser: verifyUser,
  verifyTransaction: verifyTransaction
};

function init(localConfig) {
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

function verifyUser(rawData, cb) {

  // TODO check fields for length, etc
  // TODO retry on network failure
  var data = _normalizeData(rawData);

  _request(uris.createAccountUri, data, function (err, res) {
    if (err) return cb(err);
    if (res.error_message) return cb(new Error(res.error_message));
    var success = res.merchantApplicationResponse.res === 'ACCEPT';
    var idResult = {success: success};
    cb(null, idResult);
  });
}

function verifyTransaction(rawData, cb) {
  var data = _normalizeData(rawData);
  var buyOrSell = rawData.transaction.buyOrSell;
  var uri = buyOrSell === 'sell' ? uris.sellUri : uris.buyUri;
  _request(uri, data, function (err, res) {
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

  var data = {
    bfn: license.firstName,
    bln: license.lastName,
    dob: dob,
    bsn: license.address,
    bc: license.city,
    bs: license.state,
    bz: license.postalCode,
    bco: license.country,
    man: license.uid
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
      data.bpbc = bitcoinAddressHash(transaction.toAddress);
  }

  if (rawData.scanData) data.scanData = rawData.scanData;

  return data;
}

function _basicAuthHeader(username, password) {
  return 'Basic ' + new Buffer(username + ':' + password).toString('base64');
}

function _request(uri, data, cb) {
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

  Wreck.post(uri, options, function(err, res, payload) {
    cb(err, payload);
  });
}

function bitcoinAddressHash(address) {
  var saltedAddress = config.salt + address;
  return crypto.createHash('sha1').update(saltedAddress).digest('hex');
}
