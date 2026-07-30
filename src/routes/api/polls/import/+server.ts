import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { repo } from '$lib/server/db/repository';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const restoredPoll = await repo.importPoll(body);
		return json({ success: true, poll: restoredPoll });
	} catch (e: any) {
		return json({ error: e.message || 'Failed to import poll backup' }, { status: 400 });
	}
};
