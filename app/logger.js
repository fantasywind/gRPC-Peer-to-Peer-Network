// @flow

import path from 'path';
import {
  createLogger,
  format,
  transports,
} from 'winston';

const LOG_PATH = path.resolve(__dirname, 'logs');

export const logger = createLogger({
  format: format.json(),
  transports: [
    new transports.File({
      filename: path.resolve(LOG_PATH, 'error.log'),
      level: 'error',
    }),
    new transports.File({
      filename: path.resolve(LOG_PATH, 'combined.log'),
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: format.simple(),
    level: 'debug',
  }));
}

export default logger;
