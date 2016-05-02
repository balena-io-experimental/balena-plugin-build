"use strict";
const DOCKER_RUN_WRAPPER = '/usr/bin/qemu-arm-static'
const DOCKER_QEMU_ENV = 'ENV QEMU_EXECVE 1'

// Wrap dockerfile RUN commands with qemu-arm-static 
// so that it is buildable on x86
//
// Also adds "ENV QEMU_EXECVE 1" to the second line
// as it is needed for forking commands to function.
//
// TODO: check why passing -execve flag does not work.
module.exports = function(body) {
	// join lines with a space if previous ends with backwards slash
	// then split them
	let lines = body.toString().replace(/\\\n/gm, ' ') 
	.split('\n')

	lines.splice(1, 0, DOCKER_QEMU_ENV); // add qemu execve flag to second line

	return lines.map((line, i) => {
		if (line.substr(0, 5) == 'RUN [') {
			const cmd = line.substr(5).trim().replace(/\s+/g, ' ')
			return `RUN [ "${DOCKER_RUN_WRAPPER}", ${cmd}`;
		}
		else if (line.substr(0,3) == 'RUN') {
			const cmd = line.substr(3).trim().replace(/\s+/g, ' ')
			return `RUN [ "${DOCKER_RUN_WRAPPER}", "/bin/sh", "-c", "${cmd}" ]`;
		}
		else {
			return line;
		}
	}).join('\n') + '\n';
}
