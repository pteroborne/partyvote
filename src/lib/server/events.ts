type EventListener = (data: any) => void;

class PollEventManager {
	private listeners: Map<string, Set<EventListener>> = new Map();

	subscribe(pollId: string, listener: EventListener): () => void {
		if (!this.listeners.has(pollId)) {
			this.listeners.set(pollId, new Set());
		}
		this.listeners.get(pollId)!.add(listener);

		return () => {
			const set = this.listeners.get(pollId);
			if (set) {
				set.delete(listener);
				if (set.size === 0) {
					this.listeners.delete(pollId);
				}
			}
		};
	}

	broadcast(pollId: string, eventName: string, payload: any) {
		const set = this.listeners.get(pollId);
		if (set) {
			const message = { event: eventName, data: payload, timestamp: new Date().toISOString() };
			set.forEach((listener) => {
				try {
					listener(message);
				} catch (e) {
					console.error('Error delivering event to listener:', e);
				}
			});
		}
	}
}

export const pollEvents = new PollEventManager();
