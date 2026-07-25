import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { repo } from '$lib/server/db/repository';
import { pollEvents } from '$lib/server/events';

export const POST: RequestHandler = async ({ params, request }) => {
	const pollId = params.id;
	const body = await request.json();
	const { step } = body;

	if (typeof step !== 'number') {
		return json({ error: 'Step must be a number' }, { status: 400 });
	}

	const updated = await repo.updatePoll(pollId, { currentRevealStep: step });
	if (!updated) {
		return json({ error: 'Poll not found' }, { status: 404 });
	}

	// Broadcast reveal step change to TV screens
	pollEvents.broadcast(pollId, 'presentation_step_changed', { currentRevealStep: step });

	return json({ poll: updated });
};
