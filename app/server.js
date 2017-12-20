// @flow

import grpc from 'grpc';
import { AWARA_PROTO } from './proto.js';
import log from './logger.js';
import { Peer } from './peers.js';

const NODE_ENV = process.env.NODE_ENV || 'development';

Peer.getInitialPeers()
  .then(() => {
    const server = new grpc.Server();

    server.addService(AWARA_PROTO.NetworkService.service, {
      Ping: (req, callback) => {
        callback(null, { message: 'Pong' });
      },
      GetPeers: (req, callback) => {
        callback(null, {
          peers: Peer.getAvailablePeers().map(peer => peer.toJSON()),
        });
      },
      FoundPeer: ({
        request,
      }, callback) => {
        Peer.found(request);

        callback(null, {});
      },
    });
    server.bind(Peer.SELF_ENDPOINT, grpc.ServerCredentials.createInsecure());
    server.start();

    log.info(`Awara Server Start On ${Peer.SELF_ENDPOINT}`);

    const selfPeer = new Peer({
      endpoint: Peer.SELF_ENDPOINT,
    });
    Peer.peers.push(selfPeer);

    selfPeer.status = Peer.Status.CONNECTED;

    Peer.initializePeersConnection();
  });

if (NODE_ENV !== 'production') {
  setInterval(() => log.verbose('heartbeat', {
    network: Peer.getAvailablePeers().map(p => p.endpoint),
  }), 2000);
}
