import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import os from 'os';

export const GET: RequestHandler = async ({ url, request }) => {
	// 1. Explicit environment variable override
	if (process.env.PUBLIC_ORIGIN) {
		return json({ origin: process.env.PUBLIC_ORIGIN });
	}

	// 2. Request host header (contains real LAN IP / Domain used by browser to open the page)
	const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host');
	const protocol = request.headers.get('x-forwarded-proto') || url.protocol || 'http:';

	if (hostHeader && !hostHeader.includes('localhost') && !hostHeader.includes('127.0.0.1')) {
		const fullOrigin = hostHeader.startsWith('http') ? hostHeader : `${protocol.replace(':', '')}://${hostHeader}`;
		return json({
			ip: hostHeader.split(':')[0],
			host: hostHeader,
			origin: fullOrigin
		});
	}

	// 3. Fallback to non-docker OS network interfaces
	const interfaces = os.networkInterfaces();
	let localIp = 'localhost';

	for (const devName in interfaces) {
		const iface = interfaces[devName];
		if (!iface) continue;

		for (const alias of iface) {
			// Filter out internal loopback and common Docker bridge IPs (172.17.x - 172.31.x)
			if (
				alias.family === 'IPv4' &&
				!alias.internal &&
				!alias.address.startsWith('172.') &&
				!alias.address.startsWith('10.244.')
			) {
				localIp = alias.address;
				break;
			}
		}
		if (localIp !== 'localhost') break;
	}

	const port = url.port || '5173';
	const scheme = url.protocol || 'http:';

	return json({
		ip: localIp,
		port,
		host: `${localIp}:${port}`,
		origin: `${scheme}//${localIp}:${port}`
	});
};
