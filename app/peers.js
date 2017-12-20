// @flow

/* eslint no-restricted-globals: 0 */

import level from 'level';
import path from 'path';
import grpc from 'grpc';
import { argv } from 'yargs';
import { AWARA_PROTO } from './proto.js';
import log from './logger.js';

const DEFAULT_PORT = 30100;
const GIVEN_PORT = argv.port ? parseInt(argv.port, 10) : DEFAULT_PORT;
const LISTEN_PORT = isNaN(GIVEN_PORT) ? DEFAULT_PORT : GIVEN_PORT;
const BIND_POINT = `0.0.0.0:${LISTEN_PORT}`;

const PEERS = 'NETWORK/PEERS';
const DB_PATH = path.resolve(__dirname, `peers.${LISTEN_PORT}.db`);

const db = level(DB_PATH);

export class Peer {
  constructor({
    endpoint,
  }) {
    this.status = Peer.Status.FRESH;
    this.endpoint = endpoint;
  }

  getPeerListAndConnect() {
    this.client.GetPeers({}, (err, { peers }) => {
      if (err) {
        log.warn('Failed to get peers', err);
      } else {
        peers.forEach(peer => Peer.found(peer));
      }
    });
  }

  pushAllPeerHoldLocally() {
    const peers = Peer.getAvailablePeers();

    peers.forEach((peer) => {
      try {
        this.client.FoundPeer(peer.toJSON(), (err) => {
          if (err) {
            throw err;
          }
        });
      } catch (ex) {
        log.warn('Push Hold Locally Peer Failed', ex);
      }
    });
  }

  connect() {
    if (this.endpoint === Peer.SELF_ENDPOINT) return;

    log.verbose(`Connect to ${this.endpoint}...`);

    this.status = Peer.Status.CONNECTING;

    this.client = new AWARA_PROTO.NetworkService(
      this.endpoint,
      grpc.credentials.createInsecure(),
    );

    this.client.Ping({}, (err) => {
      if (err) {
        if (err.message === 'Connect Failed') {
          log.verbose('Connect failed', this.toJSON());
        }

        this.status = Peer.Status.DEAD;
      } else {
        log.verbose('Connected to peer', this.toJSON());

        this.status = Peer.Status.CONNECTED;

        Peer.broadcastPeerFound(this);

        this.getPeerListAndConnect();

        this.pushAllPeerHoldLocally();
      }
    });
  }

  static SELF_ENDPOINT = BIND_POINT

  static Status = {
    0: 'FRESH',
    1: 'CONNECTING',
    2: 'CONNECTED',
    3: 'DEAD',
    FRESH: 0,
    CONNECTING: 1,
    CONNECTED: 2,
    DEAD: 3,
  }

  static broadcastPeerFound(newPeer) {
    const peers = Peer.getAvailablePeers();

    peers.forEach(async (peer) => {
      if (!peer.client || newPeer === peer) return;

      try {
        peer.client.FoundPeer(newPeer.toJSON(), (err) => {
          if (err) {
            throw err;
          }
        });
      } catch (ex) {
        log.warn('Broadcast Found Peer Failed', ex);
      }
    });
  }

  static found(payload) {
    const existed = Peer.peers.find(peer => peer.endpoint === payload.endpoint);

    if (existed) {
      log.verbose('Receive recorded peer', payload);
    } else {
      const peer = new Peer(payload);

      Peer.peers.push(peer);

      log.verbose('Found new peer', payload);

      peer.connect();
    }
  }

  static getAvailablePeers() {
    return Peer.peers.filter(peer => peer.status === Peer.Status.CONNECTED);
  }

  static peers = [];

  static initializePeersConnection() {
    Peer.peers.forEach((peer) => {
      peer.connect();
    });
  }

  static async resetStoredPeers() {
    await db.put(PEERS, '[]');

    log.info('Initialize Network Peers Storage');
  }

  static async getInitialPeers() {
    try {
      const data = await db.get(PEERS);

      const storedPeers = JSON.parse(data);

      if (Array.isArray(storedPeers)) {
        storedPeers.forEach((endpoint) => {
          Peer.peers.push(new Peer(endpoint));
        });

        log.info('Stored Peers Loaded!');
      }
    } catch (ex) {
      switch (ex.name) {
        case 'NotFoundError':
          await Peer.resetStoredPeers();
          break;

        case 'SyntaxError':
          log.info('Stored Peers Data Failure, Rebuild...');

          await Peer.resetStoredPeers();
          break;

        default:
          log.error('Fatal Error on LevelDB', ex);

          throw ex;
      }
    }

    return Peer.peers;
  }

  toJSON() {
    return {
      endpoint: this.endpoint,
    };
  }
}

export default Peer;
