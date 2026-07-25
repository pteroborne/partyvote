import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env as dynamicPrivateEnv } from '$env/dynamic/private';
import { env as dynamicPublicEnv } from '$env/dynamic/public';
import os from 'os';

export const GET: RequestHandler = async ({ url, request }) => {
	// 1. Check runtime environment variables (Dynamic SvelteKit Env)
	const publicOrigin = dynamicPublicEnv.PUBLIC_ORIGIN || dynamicPrivateEnv.PUBLIC_ORIGIN || process.env.PUBLIC_ORIGIN;
	if (publicOrigin && publicOrigin.trim()) {
		return json({ origin: publicOrigin.trim() });
	}

	// 2. Check Host / X-Forwarded-Host header
	const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host');
	const protocol = request.headers.get('x-forwarded-proto') || url.protocol || 'http:';

	if (
		hostHeader &&
		!hostHeader.includes('localhost') &&
		!hostHeader.includes('127.0.0.1') &&
		!hostHeader.startsWith('172.')
	) {
		const fullOrigin = hostHeader.startsWith('http') ? hostHeader : `${protocol.replace(':', '')}://${hostHeader}`;
		return json({
			ip: hostHeader.split(':')[0],
			host: hostHeader,
			origin: fullOrigin
		});
	}

	// 3. Fallback OS network interfaces
	const interfaces = os.networkInterfaces();
	let localIp = 'localhost';

	for (const devName in interfaces) {
		const iface = interfaces[devName];
		if (!iface) continue;

		for (const alias of iface) {
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
