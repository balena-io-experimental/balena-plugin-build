"use strict";
const path = require('path');
const fs = require('fs');
const Docker = require('dockerode');
const tarFs = require('tar-fs');
const tar = require('tar-stream');
const mkdirp = require('mkdirp');

const dockerfileWrapper = require('./dockerfile-wrapper');

const DOCKER_SOCKET = '/var/run/docker.sock';
const DOCKER_IMAGE_TAG = 'resin_app';

// Create a tar stream from project source directory.
// Dockerfile is modified so that it is x86 compatible.
function packProjectDirectory(dir) {
	let pack = tar.pack();
	const dockerfilePath = path.join(dir, 'Dockerfile');
	const dockerfileContents = dockerfileWrapper(fs.readFileSync(dockerfilePath));
	pack.entry({ name: 'Dockerfile' }, dockerfileContents);
	return tarFs.pack(dir, {pack: pack, ignore: (path) => path == dockerfilePath});
}

// Write to projectPath/.resin/image a file containing the image id created.
// Used by `resin run` plugin.
function writeBuildImageId(projectPath, imageId, callback) {
	const configDir = path.join(projectPath, '.resin');
	const imageIdFile = path.join(configDir, 'image');
	mkdirp(configDir, (err) => {
		if (err) return callback(err);
		fs.writeFile(imageIdFile, imageId, callback);
	});
}

// Handle docker build output.
function onBuildProgress(evt) {
	if (!evt.stream) {
		return;
	}
	// Remove qemu wrapper from output to make it prettier.
	const msg = evt.stream.replace('RUN /usr/bin/qemu-arm-static /bin/sh -c ', 'RUN ')
	.replace('RUN /usr/bin/qemu-arm-static ', 'RUN ');
	process.stdout.write(msg);
}

// Handle docker build finish.
// Get created image information and store built image id.
function onBuildFinish(docker, projectPath, callback) {
	return () => {
		docker.getImage(DOCKER_IMAGE_TAG).inspect((err, imageInfo) => {
			if (err) return callback(err);
			const id = imageInfo.Id.substr(7).trim();
			writeBuildImageId(projectPath, id, callback);
		});
	}
}

// Main function, does all docker API requests.
function build(opts) {
	const projectPath = path.resolve(opts.path || '.');
	const callback = opts.callback || function() {};
	let docker = new Docker({ socketPath: DOCKER_SOCKET });
	let tarStream = packProjectDirectory(projectPath);
	docker.buildImage(tarStream, { t: DOCKER_IMAGE_TAG }, (err, stream) => {
		if (err) return callback(err);
		docker.modem.followProgress(stream, onBuildFinish(docker, projectPath, callback), onBuildProgress);
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
