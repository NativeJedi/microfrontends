// webpack replaces process.env.NODE_ENV with the build mode at compile time.
declare const process: { env: { NODE_ENV: 'development' | 'production' } };
