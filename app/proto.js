// @flow

import grpc from 'grpc';
import path from 'path';

const PROTO_FILE = path.resolve(__dirname, 'awara.proto');
export const AWARA_PROTO = grpc.load(PROTO_FILE).awara;

export default AWARA_PROTO;
