import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { repo } from '$lib/server/db/repository';
import { pollEvents } from '$lib/server/events';

export const POST: RequestHandler = async ({ params, request }) => {
	const pollId = params.id;
	const body = await request.json();
	const { step, subStep, isAutoPlaying } = body;

	const updates: Record<string, any> = {};
	if (typeof step === 'number') updates.currentRevealStep = step;
	if (typeof subStep === 'number') updates.currentRevealSubStep = subStep;
	if (typeof isAutoPlaying === 'boolean') updates.isAutoPlaying = isAutoPlaying;

	const updated = await repo.updatePoll(pollId, updates);
	if (!updated) {
		return json({ error: 'Poll not found' }, { status: 404 });
	}

	// Broadcast reveal step change to TV screens
	pollEvents.broadcast(pollId, 'presentation_step_changed', {
		currentRevealStep: updated.currentRevealStep,
		currentRevealSubStep: updated.currentRevealSubStep ?? 0,
		isAutoPlaying: updated.isAutoPlaying ?? false
	});

	return json({ poll: updated });
};
