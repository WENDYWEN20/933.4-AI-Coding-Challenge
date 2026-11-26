(function initStorageHelpers() {
	const STORAGE_KEY = "flashcards.app.state";
	const STORAGE_VERSION = 2;

	function isValidDeck(deck) {
		return (
			deck &&
			typeof deck.id === "string" &&
			typeof deck.name === "string" &&
			typeof deck.createdAt === "number"
		);
	}

	function isValidCard(card) {
		return (
			card &&
			typeof card.id === "string" &&
			typeof card.front === "string" &&
			typeof card.back === "string" &&
			typeof card.updatedAt === "number"
		);
	}

	function normalizeV2(data) {
		if (!data || typeof data !== "object") {
			return null;
		}

		if (!Array.isArray(data.decks) || !data.decks.every(isValidDeck)) {
			return null;
		}

		if (!data.cardsByDeckId || typeof data.cardsByDeckId !== "object") {
			return null;
		}

		const normalizedCardsByDeckId = {};
		for (const deck of data.decks) {
			const cards = data.cardsByDeckId[deck.id] || [];
			if (!Array.isArray(cards) || !cards.every(isValidCard)) {
				return null;
			}
			normalizedCardsByDeckId[deck.id] = cards.map((card) => ({
				id: card.id,
				front: card.front,
				back: card.back,
				updatedAt: card.updatedAt
			}));
		}

		let activeDeckId = null;
		if (typeof data.activeDeckId === "string" && normalizedCardsByDeckId[data.activeDeckId]) {
			activeDeckId = data.activeDeckId;
		} else if (data.decks[0]) {
			activeDeckId = data.decks[0].id;
		}

		const maxCards = activeDeckId ? normalizedCardsByDeckId[activeDeckId].length : 0;
		const safeIndex = typeof data.ui?.activeCardIndex === "number" ? data.ui.activeCardIndex : 0;

		return {
			decks: data.decks.map((deck) => ({
				id: deck.id,
				name: deck.name,
				createdAt: deck.createdAt
			})),
			cardsByDeckId: normalizedCardsByDeckId,
			activeDeckId,
			ui: {
				isModalOpen: Boolean(data.ui?.isModalOpen),
				activeCardIndex: Math.max(0, Math.min(safeIndex, Math.max(0, maxCards - 1)))
			}
		};
	}

	function migrateFromV1(oldData) {
		if (!oldData || typeof oldData !== "object" || !Array.isArray(oldData.decks)) {
			return null;
		}

		const now = Date.now();
		const decks = [];
		const cardsByDeckId = {};

		for (const oldDeck of oldData.decks) {
			if (!oldDeck || typeof oldDeck.name !== "string") {
				continue;
			}

			const deckId = `deck-${String(oldDeck.id ?? Math.random()).replace(/\s+/g, "")}`;
			decks.push({
				id: deckId,
				name: oldDeck.name,
				createdAt: now
			});

			const cards = Array.isArray(oldDeck.cards) ? oldDeck.cards : [];
			cardsByDeckId[deckId] = cards
				.filter((card) => card && typeof card.front === "string" && typeof card.back === "string")
				.map((card) => ({
					id: `card-${String(card.id ?? Math.random()).replace(/\s+/g, "")}`,
					front: card.front,
					back: card.back,
					updatedAt: now
				}));
		}

		if (decks.length === 0) {
			return null;
		}

		const activeDeck = decks[0];
		return normalizeV2({
			decks,
			cardsByDeckId,
			activeDeckId: activeDeck.id,
			ui: {
				isModalOpen: false,
				activeCardIndex: 0
			}
		});
	}

	function loadState() {
		try {
			const raw = window.localStorage.getItem(STORAGE_KEY);
			if (!raw) {
				return null;
			}

			const parsed = JSON.parse(raw);
			if (!parsed || typeof parsed !== "object") {
				return null;
			}

			if (parsed.version === STORAGE_VERSION) {
				return normalizeV2(parsed.data);
			}

			if (parsed.version === 1) {
				return migrateFromV1(parsed.data);
			}

			return null;
		} catch (_error) {
			return null;
		}
	}

	function saveState(data) {
		const normalized = normalizeV2(data);
		if (!normalized) {
			return false;
		}

		try {
			window.localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					version: STORAGE_VERSION,
					data: normalized
				})
			);
			return true;
		} catch (_error) {
			return false;
		}
	}

	window.storageHelpers = {
		loadState,
		saveState
	};
})();
