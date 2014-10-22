'use strict';

var LamassuConfig = require('lamassu-config');
var promptly = require('promptly');

var config = new LamassuConfig();

console.log('\nSetting up the IdentityMind plugin.\n');
console.log('Please enter your API credentials.\n');
promptly.prompt('Username: ', function(userErr, username) {
  promptly.password('Password: ', function(passErr, password) {
    promptly.prompt('Hashing Salt (provided by identity mind): ', function(saltErr, salt) {
      promptly.confirm('Staging mode? [n]:' , {default: false}, function(testErr, test) {
        updateDb(username, password, salt, test, function(err) {
          if (err) throw err;
          console.log('\nSuccess.');
        });
      });
    });
  });
});

function updateDb(username, password, salt, test, callback) {
  var host = test ? 'staging.identitymind.com' : 'edna.identitymind.com';
  var newConfig = {
    exchanges: {
      settings: {
        compliance: {
          idVerificationEnabled: true,
          idVerificationLimit: 0
        }
      },
      plugins: {
        settings: {
          identitymind: {
            username: username,
            password: password,
            host: host,
            salt: salt
          }
        }
        current: {
          idVerifier: identitymind
        }
      }
    }
  };
  config.mergeConfig(newConfig, callback);
}
