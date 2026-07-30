import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { repo } from '$lib/server/db/repository';

export const GET: RequestHandler = async ({ params }) => {
	const pollId = params.id;
	const dump = await repo.exportPoll(pollId);

	if (!dump) {
		return json({ error: 'Poll not found' }, { status: 404 });
	}

	return new Response(JSON.stringify(dump, null, 2), {
		headers: {
			'Content-Type': 'application/json',
			'Content-Disposition': `attachment; filename="partyvote-poll-${pollId}.json"`
		}
	});
};
