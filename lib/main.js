'use strict';

var url = require('url');
var Nipple = require('nipple');

var IdentityMindApi = function(config) {
  var host = config.host;

  this.config = config;
  this.firstPassBuyUri = url.format({
    protocol: 'https',
    host: host,
    pathname: 'im/account/transferin'
  });
};

IdentityMindApi.factory = function factory(config) {
  return new IdentityMindApi(config);
};

module.exports = IdentityMindApi;

IdentityMindApi.prototype.verify = function verify(rawData, cb) {
  var config = this.config;

  // TODO check fields for length, etc
  // TODO retry on network failure
  var data = _normalizeData(rawData);

  if (config.mock) {
    console.dir(data);
    return cb(null, {success: true});
  }

  var username = this.config.username;
  var password = this.config.password;
  var uri = this.firstPassBuyUri;
  _request(uri, username, password, data, function (err, res) {
    if (err) return cb(err);
    if (res.error_message) return cb(new Error(res.error_message));
    var success = res.res === 'ACCEPT';
    var idResult = {success: success};
    cb(null, idResult);
  });
};

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
    bco: license.country
  };

  if (rawData.licenseCode) {
    // Pad with zeros
    var paddedCode = String('0000' + rawData.licenseCode).slice(-4);
    data.assnl4 = paddedCode;
  }

  return data;
}

function _basicAuthHeader(username, password) {
  return 'Basic ' + new Buffer(username + ':' + password).toString('base64');
}

function _request(uri, username, password, data, cb) {
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

  Nipple.post(uri, options, function(err, res, payload) {
    cb(err, payload);
  });
}
