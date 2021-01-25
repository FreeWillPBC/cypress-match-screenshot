/* eslint-disable no-unused-vars */
const fs = require('fs');

const touch = require('touch');

function registerTask(on, config) {
  on('task', {
    mkdir(newDir) {
      return new Promise((resolve, reject) => {
        fs.mkdir(newDir, resolve);
      });
    },
    touch(path) {
      return new Promise((resolve, reject) => {
        touch(path, null, resolve);
      });
    },
    rename({ from, to }) {
      return new Promise((resolve, reject) => {
        fs.rename(from, to, resolve);
      });
    },
    copy({ from, to }) {
      return new Promise((resolve, reject) => {
        fs.createReadStream(from).pipe(fs.createWriteStream(to)).on('finish', () => {
          resolve(null);
        });
      });
    },
    unlink(path) {
      return new Promise((resolve, reject) => {
        fs.unlink(path, resolve);
      });
    },
    exists(path) {
      return new Promise((resolve, reject) => {
        fs.exists(path, resolve);
      });
    },
  });
}

module.exports = registerTask;
