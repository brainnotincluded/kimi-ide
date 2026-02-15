/**
 * Webpack configuration for Kimi IDE Extension
 * 
 * This configuration bundles the extension for production,
 * reducing load time and improving performance.
 */

const path = require('path');

/** @type {import('webpack').Configuration} */
const config = {
  target: 'node',
  mode: 'none', // VS Code extensions run in Node.js context

  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]',
  },

  devtool: 'source-map',

  externals: {
    // VS Code extension API is provided at runtime
    vscode: 'commonjs vscode',
    
    // Optional: externalize heavy dependencies
    // Add here any modules that should not be bundled
  },

  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      // Optional: path aliases
      '@': path.resolve(__dirname, 'src'),
    },
  },

  module: {
    rules: [
      {
        test: \\ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              compilerOptions: {
                module: 'es6',
                sourceMap: true,
              },
              transpileOnly: true, // Faster builds, type checking done separately
            },
          },
        ],
      },
    ],
  },

  // Performance hints
  performance: {
    hints: 'warning',
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
  },

  // Optimization for production
  optimization: {
    minimize: false, // VS Code extensions should not be minified for debugging
  },

  // Stats configuration
  stats: {
    all: false,
    errors: true,
    warnings: true,
    colors: true,
  },

  // Ignore warnings for optional dependencies
  ignoreWarnings: [
    {
      module: /node_modules\\/keyv/,
    },
  ],
};

module.exports = config;
