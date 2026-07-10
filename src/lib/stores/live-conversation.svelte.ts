class LiveConversationStore {
	isActive = $state(false);

	open() {
		this.isActive = true;
	}

	close() {
		this.isActive = false;
	}
}

export const liveConversationStore = new LiveConversationStore();
