import type { RequestHandler } from './$types';
import { pollEvents } from '$lib/server/events';

export const GET: RequestHandler = async ({ params }) => {
	const pollId = params.id;

	let unsubscribe: (() => void) | null = null;
	let interval: NodeJS.Timeout | null = null;
	let isClosed = false;

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			const listener = (eventData: any) => {
				if (isClosed) return;
				try {
					const message = `event: ${eventData.event}\ndata: ${JSON.stringify(eventData.data)}\n\n`;
					controller.enqueue(encoder.encode(message));
				} catch (e) {
					// Client disconnected or stream closed
					cleanup();
				}
			};

			const cleanup = () => {
				if (isClosed) return;
				isClosed = true;
				if (interval) clearInterval(interval);
				if (unsubscribe) unsubscribe();
				try {
					controller.close();
				} catch (e) {
					// Controller might already be closed
				}
			};

			// Initial connection message
			try {
				controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`));
			} catch (e) {
				cleanup();
				return;
			}

			unsubscribe = pollEvents.subscribe(pollId, listener);

			// Heartbeat ping every 10s
			interval = setInterval(() => {
				if (isClosed) return;
				try {
					controller.enqueue(encoder.encode(`:ping\n\n`));
				} catch (e) {
					cleanup();
				}
			}, 10000);
		},
		cancel() {
			isClosed = true;
			if (interval) clearInterval(interval);
			if (unsubscribe) unsubscribe();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			'Connection': 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
