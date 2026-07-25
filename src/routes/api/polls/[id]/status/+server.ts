import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { repo } from '$lib/server/db/repository';
import { pollEvents } from '$lib/server/events';

export const POST: RequestHandler = async ({ params, request }) => {
	const pollId = params.id;
	const body = await request.json();
	const { status } = body;

	if (!['draft', 'active', 'closed'].includes(status)) {
		return json({ error: 'Invalid status' }, { status: 400 });
	}

	const updated = await repo.updatePoll(pollId, { status });
	if (!updated) {
		return json({ error: 'Poll not found' }, { status: 404 });
	}

	// Broadcast status change event to TV presentation screens
	pollEvents.broadcast(pollId, 'status_changed', { status });

	return json({ poll: updated });
};
