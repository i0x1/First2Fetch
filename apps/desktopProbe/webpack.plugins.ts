import type IForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

export const plugins = [
  new ForkTsCheckerWebpackPlugin({
    logger: 'webpack-infrastructure',
  }),
  new webpack.EnvironmentPlugin([
    'APP_BUNDLE_ID',
    'SUPABASE_URL',
    'SUPABASE_KEY',
    'MEZMO_API_KEY',
    'AMPLITUDE_API_KEY',
  ]),
  new CopyWebpackPlugin({
    patterns: [
      { from: path.join(__dirname, 'images'), to: 'images' },
      { from: path.join(__dirname, 'images'), to: 'assets' },
      // Copy public directory (including job-search-next/assets) for library compatibility
      { 
        from: path.join(__dirname, 'public'), 
        to: '.',
        noErrorOnMissing: true,
        globOptions: {
          ignore: ['**/.gitkeep'],
        },
      },
    ],
  }),
];
