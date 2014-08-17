'use strict';

var LamassuConfig = require('lamassu-config');
var promptly = require('promptly');

var config = new LamassuConfig();

console.log('\nSetting up the IdentityMind plugin.\n');
console.log('Please enter your API credentials.\n');
promptly.prompt('Username: ', function(userErr, username) {
  promptly.password('Password: ', function(passErr, password) {
    promptly.confirm('Test mode? [n]:' , {default: false}, function(testErr, test) {
      updateDb(username, password, test, function(err) {
        if (err) throw err;
        console.log('\nSuccess.');
      });
    });
  });
});

function updateDb(username, password, test, callback) {
  var host = test ? 'staging.identitymind.com' : 'edna.identitymind.com';
  var newConfig = {
    exchanges: {
      settings: {
        compliance: {
          idVerificationLimit: 0
        }
      },
      plugins: {
        settings: {
          identitymind: {
            username: username,
            password: password,
            host: host
          }
        }
      }
    }
  };
  config.mergeConfig(newConfig, callback);
}
