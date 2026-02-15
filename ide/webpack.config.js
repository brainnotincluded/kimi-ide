const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = {
  mode: 'development',
  target: 'electron-renderer',
  
  entry: './src/renderer/index.tsx',
  
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'renderer.js',
    clean: true,
  },
  
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
  },
  
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.ttf$/,
        use: ['file-loader'],
      },
    ],
  },
  
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      inject: 'body',
    }),
    new MonacoWebpackPlugin({
      languages: ['typescript', 'javascript', 'python', 'rust', 'go', 'java', 'cpp', 'c', 'json', 'yaml', 'markdown', 'css', 'html', 'shell'],
      filename: '[name].worker.js',
    }),
  ],
  
  devtool: 'source-map',
};
