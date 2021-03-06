'use strict';
var common = require('../common');
var assert = require('assert');

if (!common.hasCrypto) {
  console.log('1..0 # Skipped: missing crypto');
  process.exit();
}
var tls = require('tls');

var fs = require('fs');
var key =  fs.readFileSync(common.fixturesDir + '/keys/agent2-key.pem');
var cert = fs.readFileSync(common.fixturesDir + '/keys/agent2-cert.pem');

var nsuccess = 0;
var nerror = 0;

function loadDHParam(n) {
  var path = common.fixturesDir;
  if (n !== 'error') path += '/keys';
  return fs.readFileSync(path + '/dh' + n + '.pem');
}

function test(size, err, next) {
  var options = {
    key: key,
    cert: cert,
    dhparam: loadDHParam(size),
    ciphers: 'DHE-RSA-AES128-GCM-SHA256'
  };

  var server = tls.createServer(options, function(conn) {
    conn.end();
  });

  server.on('close', function(isException) {
    assert(!isException);
    if (next) next();
  });

  server.listen(common.PORT, '127.0.0.1', function() {
    // client set minimum DH parameter size to 2048 bits so that
    // it fails when it make a connection to the tls server where
    // dhparams is 1024 bits
    var client = tls.connect({
      minDHSize: 2048,
      port: common.PORT,
      rejectUnauthorized: false
    }, function() {
      nsuccess++;
      server.close();
    });
    if (err) {
      client.on('error', function(e) {
        nerror++;
        assert.strictEqual(e.message, 'DH parameter size 1024 is less'
                           + ' than 2048');
        server.close();
      });
    }
  });
}

// A client connection fails with an error when a client has an
// 2048 bits minDHSize option and a server has 1024 bits dhparam
function testDHE1024() {
  test(1024, true, testDHE2048);
}

// A client connection successes when a client has an
// 2048 bits minDHSize option and a server has 2048 bits dhparam
function testDHE2048() {
  test(2048, false, null);
}

testDHE1024();

process.on('exit', function() {
  assert.equal(nsuccess, 1);
  assert.equal(nerror, 1);
});
