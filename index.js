"use strict";
const path = require('path');
const fs = require('fs');
const Docker = require('dockerode');
const tarFs = require('tar-fs');
const tar = require('tar-stream');

const dockerfileWrapper = require('./dockerfile-wrapper');

const DOCKER_SOCKET = '/var/run/docker.sock'

function onProgress(evt) {
	if (!evt.stream) {
		return;
	}
	// remove qemu wrapper from output to make it prettier
	const msg = evt.stream.replace('RUN /usr/bin/qemu-arm-static /bin/sh -c ', 'RUN ')
	.replace('RUN /usr/bin/qemu-arm-static ', 'RUN ');
	process.stdout.write(msg);
}

function packProjectDirectory(dir) {
	let pack = tar.pack();
	const dockerfilePath = path.join(dir, 'Dockerfile')
	const dockerfileContents = dockerfileWrapper(fs.readFileSync(dockerfilePath))
	pack.entry({ name: 'Dockerfile' }, dockerfileContents);
	return tarFs.pack(dir, {pack: pack, ignore: (path) => path == dockerfilePath});
}

function build(opts) {
	const projectPath = path.resolve(opts.path || '.');
	const callback = opts.callback || function() {};
	let docker = new Docker({ socketPath: DOCKER_SOCKET });
	let tarStream = packProjectDirectory(projectPath);
	docker.buildImage(tarStream, (err, stream) => {
		if (err) {
			return callback(err);
		}
		docker.modem.followProgress(stream, callback, onProgress);
	});
}

module.exports = {
	signature: 'build [path]',
	description: 'build your application locally (requires docker)',
	help: `Build your application locally.

Requires docker to be installed and running.`,
	action: function(params, options, done) {
		build({ path: params[0], callback: done });
	}
};
