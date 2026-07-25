import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import os from 'os';

export const GET: RequestHandler = async ({ url }) => {
	const interfaces = os.networkInterfaces();
	let localIp = 'localhost';

	for (const devName in interfaces) {
		const iface = interfaces[devName];
		if (!iface) continue;

		for (const alias of iface) {
			// Skip internal loopback and non-IPv4 addresses
			if (alias.family === 'IPv4' && !alias.internal) {
				localIp = alias.address;
				break;
			}
		}
		if (localIp !== 'localhost') break;
	}

	const port = url.port || '5173';
	const protocol = url.protocol || 'http:';

	return json({
		ip: localIp,
		port,
		host: `${localIp}:${port}`,
		origin: `${protocol}//${localIp}:${port}`
	});
};
