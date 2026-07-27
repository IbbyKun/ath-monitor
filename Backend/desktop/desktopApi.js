'use strict';
// Optional APM. `newrelic` is not a declared dependency of this service (it is in
// no package.json, has no newrelic.js config and no NEW_RELIC_* env vars) — it was
// historically supplied by the host environment. Load it only if it is actually
// installed, so a clean production container without it still boots.
if (process.env.NODE_ENV === 'production') {
    try {
        require('newrelic');
    } catch (err) {
        if (err.code !== 'MODULE_NOT_FOUND') throw err;
    }
}
if (process.env.IS_DEBUGGING) console.log(`= server.js loaded => ${process.env.NODE_ENV} =`);


/**
 * initialising app
 * every varibale in .env will be available in process.env object
 */
const dotenv = require('dotenv');
dotenv.config();

/**
 * initialising app
 */
const App = require('./src/App');
// const cluster = require('cluster');

// if (cluster.isMaster) {
//     const numWorkers = require('os').cpus().length;

//     console.log('Master cluster setting up ' + numWorkers + ' workers...');

//     for (var i = 0; i < numWorkers; i++) {
//         cluster.fork();
//     }

//     cluster.on('online', function (worker) {
//         console.log('Worker ' + worker.process.pid + ' is online');
//     });

//     cluster.on('exit', function (worker, code, signal) {
//         console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
//         console.log('Starting a new worker');
//         cluster.fork();
//     });
// } else {
App.core();
// }



// const heapProfile = require('heap-profile');
// heapProfile.start();
// setInterval(() => {
//     heapProfile.write((err, filename) => {
//         console.log(`heapProfile.write. err: ${err} filename: ${filename}`);
//     });
// }, 2 * 60 * 60 * 1000);