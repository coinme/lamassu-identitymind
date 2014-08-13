'use strict';

var Nipple = require('nipple');

var FIELDS = [
  'username', 'password', 'invoice', 'amount', 'shipping', 'tax',
  'total', 'idType', 'idIssuer', 'idNumber', 'paymentMethod', 'firstName',
  'lastName', 'address', 'city', 'state', 'zip', 'ssnLast4', 'ssn', 'dobMonth',
  'dobDay', 'dobYear', 'ipAddress', 'sku', 'uid'
];

var IdentityMindApi = function(config) {
  this.config = config;
  this.uri = config.uri;
};

IdentityMindApi.factory = function factory(config) {
  return new IdentityMindApi(config);
};

module.exports = IdentityMindApi;

// Callback returns cb(err, idPassed, usageError)
// Where idPassed indicates whether ID is okay,
// usageError is null if okay, or error string
// if over limit.
IdentityMindApi.prototype.verify = function verify(rawData, cb) {
  var config = this.config;

  // TODO check fields for length, etc
  // TODO retry on network failure
  var data = _normalizeData(rawData);

  if (config.mock) {
    console.dir(data);
    return cb(null, {success: true});
  }

  var fields = {
    username: config.username,
    password: config.password
  };

  for (var i = 0; i < FIELDS.length; i++) {
    var field = FIELDS[i];
    fields[field] = fields[field] || data[field];
  }

  _request(this.uri, fields, function (err, res) {
    if (err) return cb(err);
    if (res.response.error) {
      return cb(new Error(res.response.error.toString()));
    }

    var idPassed = res.response['summary-result'].key === 'id.success';
    var idResult = {success: idPassed};
    cb(err, idResult);
  });
};

// Normalizes from Rakia standard
function _normalizeData(rawData) {
  var dob = rawData.license.dateOfBirth; // Format is YYYMMDD

  // Pad with zeros
  var paddedCode = String('0000' + rawData.licenseCode).slice(-4);

  var data = {
    ssnLast4: paddedCode,
    zip: rawData.license.postalCode,
    dobYear: dob.substr(0, 4),
    dobMonth: dob.substr(4, 2),
    dobDay: dob.substr(6, 2)
  };

  for (var i = 0; i < FIELDS.length; i++) {
    var field = FIELDS[i];

    // IdentityMind wants all fields, even if blank
    data[field] = data[field] || rawData.license[field] || '';
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
    payload: fields,
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
