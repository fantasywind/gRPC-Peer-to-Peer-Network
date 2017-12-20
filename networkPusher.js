// @flow

const grpc = require('grpc');
const path = require('path');

const PROTO_FILE = path.resolve(__dirname, 'app/awara.proto');
const awaraProto = grpc.load(PROTO_FILE).awara;

const client = new awaraProto.NetworkService('0.0.0.0:30102', grpc.credentials.createInsecure());

client.FoundPeer({
  endpoint: '0.0.0.0:30101',
}, (err) => {
  console.log(err);
});

setTimeout(() => {
  client.FoundPeer({
    endpoint: '0.0.0.0:30100',
  }, (err) => {
    console.log(err);
  });
}, 10000);
