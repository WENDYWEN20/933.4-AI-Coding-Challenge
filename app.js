function nowTs() {
	return Date.now();
}

function makeDeck(name) {
	return {
		id: `deck-${nowTs()}-${Math.random().toString(36).slice(2, 8)}`,
		name,
		createdAt: nowTs()
	};
}

function makeCard(front, back) {
	return {
		id: `card-${nowTs()}-${Math.random().toString(36).slice(2, 8)}`,
		front,
		back,
		updatedAt: nowTs()
	};
}

const seededDecks = [
	makeDeck("HTML Basics"),
	makeDeck("CSS Fundamentals"),
	makeDeck("JavaScript Intro")
];

const seededCardsByDeckId = {
	[seededDecks[0].id]: [
		makeCard("What does HTML stand for?", "HyperText Markup Language"),
		makeCard("What tag creates a hyperlink?", "The a tag")
	],
	[seededDecks[1].id]: [
		makeCard("What does CSS stand for?", "Cascading Style Sheets")
	],
	[seededDecks[2].id]: [
		makeCard("Which keyword declares a constant?", "const")
	]
};

const persisted = window.storageHelpers ? window.storageHelpers.loadState() : null;

const state = persisted || {
	decks: seededDecks,
	cardsByDeckId: seededCardsByDeckId,
	activeDeckId: seededDecks[0].id,
	ui: {
		isModalOpen: false,
		activeCardIndex: 0
	}
};

const runtime = {
	deckModalMode: "create",
	cardModalMode: "create",
	editingCardId: null,
	isCardFlipped: false,
	searchQuery: "",
	studyDeckId: null,
	studyCardOrderIds: [],
	lastModalOpener: null,
	activeModalElement: null,
	studyKeydownHandler: null,
	searchDebounceTimer: null
};

if (!state.decks.find((deck) => deck.id === state.activeDeckId)) {
	state.activeDeckId = state.decks[0] ? state.decks[0].id : null;
}

const ui = {
	newDeckBtn: document.getElementById("new-deck-btn"),
	editDeckBtn: document.getElementById("edit-deck-btn"),
	deleteDeckBtn: document.getElementById("delete-deck-btn"),
	deckList: document.getElementById("deck-list"),
	deckEmptyState: document.getElementById("deck-empty-state"),
	deckTitle: document.getElementById("deck-title"),
	flashcard: document.querySelector(".flashcard"),
	cardFrontContent: document.getElementById("card-front-content"),
	cardBackContent: document.getElementById("card-back-content"),
	cardList: document.getElementById("card-list"),
	cardEmptyState: document.getElementById("card-empty-state"),
	cardEmptyTitle: document.getElementById("card-empty-title"),
	cardEmptyText: document.getElementById("card-empty-text"),
	searchInput: document.getElementById("search-cards"),
	searchCount: document.getElementById("search-count"),
	appStatus: document.getElementById("app-status"),
	newCardBtn: document.getElementById("new-card-btn"),
	editCardBtn: document.getElementById("edit-card-btn"),
	deleteCardBtn: document.getElementById("delete-card-btn"),
	shuffleBtn: document.getElementById("shuffle-btn"),
	prevCardBtn: document.getElementById("prev-card-btn"),
	flipCardBtn: document.getElementById("flip-card-btn"),
	nextCardBtn: document.getElementById("next-card-btn"),
	deckModal: document.getElementById("deck-modal"),
	deckModalTitle: document.getElementById("deck-modal-title"),
	deckForm: document.getElementById("deck-form"),
	deckNameInput: document.getElementById("deck-name-input"),
	deckNameError: document.getElementById("deck-name-error"),
	deckCancelBtn: document.getElementById("deck-cancel-btn"),
	cardModal: document.getElementById("card-modal"),
	cardModalTitle: document.getElementById("card-modal-title"),
	cardSaveBtn: document.getElementById("card-save-btn"),
	cardForm: document.getElementById("card-form"),
	cardFrontInput: document.getElementById("card-front-input"),
	cardFrontError: document.getElementById("card-front-error"),
	cardBackInput: document.getElementById("card-back-input"),
	cardBackError: document.getElementById("card-back-error"),
	cardCancelBtn: document.getElementById("card-cancel-btn")
};

function persistState() {
	if (!window.storageHelpers) {
		return;
	}
	window.storageHelpers.saveState(state);
}

function getActiveDeck() {
	if (!state.activeDeckId) {
		return null;
	}
	return state.decks.find((deck) => deck.id === state.activeDeckId) || null;
}

function getCardsForDeck(deckId) {
	if (!deckId) {
		return [];
	}
	return state.cardsByDeckId[deckId] || [];
}

function getSearchFilteredCardIds(deckId) {
	const cards = getCardsForDeck(deckId);
	if (!runtime.searchQuery) {
		return cards.map((card) => card.id);
	}

	return cards
		.filter((card) => {
			const q = runtime.searchQuery;
			return card.front.toLowerCase().includes(q) || card.back.toLowerCase().includes(q);
		})
		.map((card) => card.id);
}

function getActiveCard() {
	const activeDeck = getActiveDeck();
	if (!activeDeck) {
		return null;
	}

	const cards = getCardsForDeck(activeDeck.id);
	if (cards.length === 0) {
		return null;
	}

	if (runtime.studyDeckId !== activeDeck.id || runtime.studyCardOrderIds.length === 0) {
		return cards[state.ui.activeCardIndex] || null;
	}

	const cardId = runtime.studyCardOrderIds[state.ui.activeCardIndex];
	if (!cardId) {
		return null;
	}

	return cards.find((card) => card.id === cardId) || null;
}

function setLiveStatus(message) {
	ui.appStatus.textContent = message;
}

function clearFieldError(inputElement, errorElement) {
	inputElement.setAttribute("aria-invalid", "false");
	errorElement.textContent = "";
	errorElement.hidden = true;
}

function setFieldError(inputElement, errorElement, message) {
	inputElement.setAttribute("aria-invalid", "true");
	errorElement.textContent = message;
	errorElement.hidden = false;
}

function validateTextField(inputElement, errorElement, options) {
	const { label, maxLength } = options;
	const value = inputElement.value.trim();
	clearFieldError(inputElement, errorElement);

	if (!value) {
		setFieldError(inputElement, errorElement, `${label} is required.`);
		return null;
	}

	if (value.length > maxLength) {
		setFieldError(inputElement, errorElement, `${label} must be ${maxLength} characters or less.`);
		return null;
	}

	return value;
}

function renderDeckList() {
	ui.deckList.innerHTML = "";
	ui.deckEmptyState.hidden = state.decks.length > 0;

	state.decks.forEach((deck) => {
		const li = document.createElement("li");
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "deck-item";
		if (deck.id === state.activeDeckId) {
			btn.classList.add("is-active");
		}
		btn.textContent = deck.name;
		btn.dataset.deckId = deck.id;
		btn.setAttribute("aria-current", deck.id === state.activeDeckId ? "true" : "false");
		li.appendChild(btn);
		ui.deckList.appendChild(li);
	});
}

function renderDeckTitle() {
	const deck = getActiveDeck();
	ui.deckTitle.textContent = deck ? deck.name : "No Decks";
}

function renderSearchCount() {
	const deck = getActiveDeck();
	if (!deck) {
		ui.searchCount.textContent = "No deck selected";
		return;
	}

	const total = getCardsForDeck(deck.id).length;
	const matches = runtime.studyCardOrderIds.length;
	ui.searchCount.textContent = runtime.searchQuery
		? `${matches} match${matches === 1 ? "" : "es"}`
		: `${total} card${total === 1 ? "" : "s"}`;
}

function renderCardList() {
	ui.cardList.innerHTML = "";
	const deck = getActiveDeck();
	if (!deck) {
		return;
	}

	const cards = getCardsForDeck(deck.id);
	const activeCard = getActiveCard();
	const activeId = activeCard ? activeCard.id : null;

	runtime.studyCardOrderIds.forEach((cardId) => {
		const card = cards.find((item) => item.id === cardId);
		if (!card) {
			return;
		}

		const li = document.createElement("li");
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "card-list-item";
		btn.dataset.cardId = card.id;
		btn.textContent = card.front;
		if (card.id === activeId) {
			btn.classList.add("is-active");
		}
		li.appendChild(btn);
		ui.cardList.appendChild(li);
	});
}

function renderCard() {
	const deck = getActiveDeck();
	const activeCard = getActiveCard();

	ui.flashcard.classList.toggle("is-flipped", runtime.isCardFlipped);
	ui.cardEmptyState.hidden = true;

	if (!deck || !activeCard) {
		const searching = Boolean(runtime.searchQuery);
		ui.cardEmptyState.hidden = false;
		ui.cardEmptyTitle.textContent = searching ? "No cards found" : "No cards yet";
		ui.cardEmptyText.textContent = searching
			? "Try another keyword or clear search."
			: "Add a new card to start studying this deck.";
		ui.cardFrontContent.textContent = searching ? "No cards found" : "No cards yet";
		ui.cardBackContent.textContent = "";
		ui.prevCardBtn.disabled = true;
		ui.nextCardBtn.disabled = true;
		ui.flipCardBtn.disabled = true;
		ui.editCardBtn.disabled = true;
		ui.deleteCardBtn.disabled = true;
		renderCardList();
		renderSearchCount();
		return;
	}

	ui.cardFrontContent.textContent = activeCard.front;
	ui.cardBackContent.textContent = activeCard.back;
	ui.prevCardBtn.disabled = false;
	ui.nextCardBtn.disabled = false;
	ui.flipCardBtn.disabled = false;
	ui.editCardBtn.disabled = false;
	ui.deleteCardBtn.disabled = false;

	renderCardList();
	renderSearchCount();
}

function updateDeckActionState() {
	const hasDecks = state.decks.length > 0;
	ui.editDeckBtn.disabled = !hasDecks;
	ui.deleteDeckBtn.disabled = !hasDecks;
	ui.newCardBtn.disabled = !hasDecks;
	ui.shuffleBtn.disabled = !hasDecks;
}

function render() {
	renderDeckList();
	renderDeckTitle();
	renderCard();
	updateDeckActionState();
}

function resetFlipState() {
	runtime.isCardFlipped = false;
	ui.flashcard.classList.remove("is-flipped");
}

function detachStudyKeyboardShortcuts() {
	if (runtime.studyKeydownHandler) {
		document.removeEventListener("keydown", runtime.studyKeydownHandler);
		runtime.studyKeydownHandler = null;
	}
}

function attachStudyKeyboardShortcuts() {
	detachStudyKeyboardShortcuts();
	runtime.studyKeydownHandler = (event) => {
		if (runtime.activeModalElement) {
			return;
		}

		const target = event.target;
		if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
			return;
		}

		if (event.code === "Space") {
			event.preventDefault();
			flipCard();
			return;
		}
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			showPreviousCard();
			return;
		}
		if (event.key === "ArrowRight") {
			event.preventDefault();
			showNextCard();
		}
	};
	document.addEventListener("keydown", runtime.studyKeydownHandler);
}

function buildCardOrderIds(deckId, shuffle = false) {
	const order = getSearchFilteredCardIds(deckId);
	if (!shuffle) {
		return order;
	}

	for (let i = order.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		const temp = order[i];
		order[i] = order[j];
		order[j] = temp;
	}
	return order;
}

function exitStudyMode() {
	detachStudyKeyboardShortcuts();
	runtime.studyDeckId = null;
	runtime.studyCardOrderIds = [];
	state.ui.activeCardIndex = 0;
}

function enterStudyMode(deckId, options = {}) {
	const { shuffle = false, focusCardId = null } = options;
	const deck = state.decks.find((item) => item.id === deckId);
	if (!deck) {
		exitStudyMode();
		renderCard();
		return;
	}

	const orderIds = buildCardOrderIds(deck.id, shuffle);
	let index = 0;
	if (focusCardId) {
		const pos = orderIds.indexOf(focusCardId);
		if (pos >= 0) {
			index = pos;
		}
	}

	runtime.studyDeckId = deck.id;
	runtime.studyCardOrderIds = orderIds;
	state.ui.activeCardIndex = orderIds.length > 0 ? index : 0;

	attachStudyKeyboardShortcuts();
	resetFlipState();
	renderCard();
}

function flipCard() {
	if (runtime.studyCardOrderIds.length === 0) {
		return;
	}
	runtime.isCardFlipped = !runtime.isCardFlipped;
	ui.flashcard.classList.toggle("is-flipped", runtime.isCardFlipped);
}

function showPreviousCard() {
	if (runtime.studyCardOrderIds.length === 0) {
		return;
	}
	if (state.ui.activeCardIndex === 0) {
		state.ui.activeCardIndex = runtime.studyCardOrderIds.length - 1;
	} else {
		state.ui.activeCardIndex -= 1;
	}
	resetFlipState();
	renderCard();
}

function showNextCard() {
	if (runtime.studyCardOrderIds.length === 0) {
		return;
	}
	state.ui.activeCardIndex = (state.ui.activeCardIndex + 1) % runtime.studyCardOrderIds.length;
	resetFlipState();
	renderCard();
}

function shuffleCards() {
	const deck = getActiveDeck();
	if (!deck || runtime.studyCardOrderIds.length < 2) {
		return;
	}
	enterStudyMode(deck.id, { shuffle: true });
}

function getFocusableElements(container) {
	return Array.from(
		container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
	).filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true");
}

function openDeckModal(mode) {
	runtime.deckModalMode = mode;
	runtime.lastModalOpener = document.activeElement;
	const deck = getActiveDeck();
	ui.deckModalTitle.textContent = mode === "edit" ? "Edit Deck" : "New Deck";
	ui.deckNameInput.value = mode === "edit" && deck ? deck.name : "";
	clearFieldError(ui.deckNameInput, ui.deckNameError);

	runtime.activeModalElement = ui.deckModal;
	state.ui.isModalOpen = true;
	ui.deckModal.classList.add("is-open");
	ui.deckModal.setAttribute("aria-hidden", "false");
	document.body.style.overflow = "hidden";
	window.setTimeout(() => {
		ui.deckNameInput.focus();
		ui.deckNameInput.select();
	}, 0);
}

function openCardModal(mode) {
	const deck = getActiveDeck();
	if (!deck) {
		return;
	}

	runtime.cardModalMode = mode;
	runtime.lastModalOpener = document.activeElement;
	const activeCard = getActiveCard();

	if (mode === "edit" && activeCard) {
		runtime.editingCardId = activeCard.id;
		ui.cardModalTitle.textContent = "Edit Card";
		ui.cardSaveBtn.textContent = "Save Changes";
		ui.cardFrontInput.value = activeCard.front;
		ui.cardBackInput.value = activeCard.back;
	} else {
		runtime.editingCardId = null;
		ui.cardModalTitle.textContent = "New Card";
		ui.cardSaveBtn.textContent = "Save Card";
		ui.cardFrontInput.value = "";
		ui.cardBackInput.value = "";
	}

	clearFieldError(ui.cardFrontInput, ui.cardFrontError);
	clearFieldError(ui.cardBackInput, ui.cardBackError);

	runtime.activeModalElement = ui.cardModal;
	state.ui.isModalOpen = true;
	ui.cardModal.classList.add("is-open");
	ui.cardModal.setAttribute("aria-hidden", "false");
	document.body.style.overflow = "hidden";
	window.setTimeout(() => ui.cardFrontInput.focus(), 0);
}

function closeModal() {
	if (!runtime.activeModalElement) {
		return;
	}
	runtime.activeModalElement.classList.remove("is-open");
	runtime.activeModalElement.setAttribute("aria-hidden", "true");
	runtime.activeModalElement = null;
	state.ui.isModalOpen = false;
	document.body.style.overflow = "";

	if (runtime.lastModalOpener && typeof runtime.lastModalOpener.focus === "function") {
		runtime.lastModalOpener.focus();
	}
}

function handleModalKeydown(event) {
	if (!runtime.activeModalElement) {
		return;
	}
	if (event.key === "Escape") {
		event.preventDefault();
		closeModal();
		return;
	}
	if (event.key !== "Tab") {
		return;
	}

	const focusable = getFocusableElements(runtime.activeModalElement);
	if (focusable.length === 0) {
		event.preventDefault();
		return;
	}

	const first = focusable[0];
	const last = focusable[focusable.length - 1];
	const active = document.activeElement;

	if (event.shiftKey && active === first) {
		event.preventDefault();
		last.focus();
	}
	if (!event.shiftKey && active === last) {
		event.preventDefault();
		first.focus();
	}
}

function createDeck(name) {
	const deck = makeDeck(name);
	state.decks.push(deck);
	state.cardsByDeckId[deck.id] = [makeCard(`${name} - Card 1`, "Add an answer with New Card.")];
	state.activeDeckId = deck.id;
	state.ui.activeCardIndex = 0;
	persistState();
	setLiveStatus(`Deck ${name} created.`);
	enterStudyMode(deck.id);
}

function editActiveDeck(name) {
	const deck = getActiveDeck();
	if (!deck) {
		return;
	}
	deck.name = name;
	persistState();
	setLiveStatus(`Deck renamed to ${name}.`);
}

function deleteActiveDeck() {
	const deck = getActiveDeck();
	if (!deck) {
		return;
	}

	if (!window.confirm(`Delete deck "${deck.name}"? This cannot be undone.`)) {
		return;
	}

	state.decks = state.decks.filter((item) => item.id !== deck.id);
	delete state.cardsByDeckId[deck.id];

	state.activeDeckId = state.decks[0] ? state.decks[0].id : null;
	state.ui.activeCardIndex = 0;
	persistState();
	setLiveStatus(`Deck ${deck.name} deleted.`);

	if (state.activeDeckId) {
		enterStudyMode(state.activeDeckId);
	} else {
		exitStudyMode();
	}
	render();
}

function deleteActiveCard() {
	const deck = getActiveDeck();
	const card = getActiveCard();
	if (!deck || !card) {
		return;
	}
	if (!window.confirm("Delete this card? This cannot be undone.")) {
		return;
	}

	const cards = getCardsForDeck(deck.id).filter((item) => item.id !== card.id);
	state.cardsByDeckId[deck.id] = cards;
	persistState();
	setLiveStatus("Card deleted.");
	enterStudyMode(deck.id);
}

function handleDeckSubmit(event) {
	event.preventDefault();
	const name = validateTextField(ui.deckNameInput, ui.deckNameError, { label: "Deck name", maxLength: 60 });
	if (!name) {
		ui.deckNameInput.focus();
		return;
	}
	if (runtime.deckModalMode === "edit") {
		editActiveDeck(name);
	} else {
		createDeck(name);
	}
	render();
	closeModal();
}

function handleCardSubmit(event) {
	event.preventDefault();
	const deck = getActiveDeck();
	if (!deck) {
		return;
	}

	const front = validateTextField(ui.cardFrontInput, ui.cardFrontError, { label: "Front", maxLength: 160 });
	if (!front) {
		ui.cardFrontInput.focus();
		return;
	}
	const back = validateTextField(ui.cardBackInput, ui.cardBackError, { label: "Back", maxLength: 240 });
	if (!back) {
		ui.cardBackInput.focus();
		return;
	}

	const cards = getCardsForDeck(deck.id);
	let focusCardId = null;

	if (runtime.cardModalMode === "edit" && runtime.editingCardId) {
		const target = cards.find((card) => card.id === runtime.editingCardId);
		if (!target) {
			return;
		}
		target.front = front;
		target.back = back;
		target.updatedAt = nowTs();
		focusCardId = target.id;
		setLiveStatus("Card updated.");
	} else {
		const card = makeCard(front, back);
		cards.push(card);
		focusCardId = card.id;
		setLiveStatus("Card created.");
	}

	persistState();
	enterStudyMode(deck.id, { focusCardId });
	closeModal();
}

function runSearch(query) {
	runtime.searchQuery = query.trim().toLowerCase();
	const deck = getActiveDeck();
	const activeCard = getActiveCard();
	const focusCardId = activeCard ? activeCard.id : null;
	if (deck) {
		enterStudyMode(deck.id, { focusCardId });
	}
	renderCard();
}

function debounceSearchInput(query) {
	if (runtime.searchDebounceTimer) {
		window.clearTimeout(runtime.searchDebounceTimer);
	}
	runtime.searchDebounceTimer = window.setTimeout(() => runSearch(query), 300);
}

ui.newDeckBtn.addEventListener("click", () => openDeckModal("create"));
ui.editDeckBtn.addEventListener("click", () => openDeckModal("edit"));
ui.deleteDeckBtn.addEventListener("click", deleteActiveDeck);

ui.newCardBtn.addEventListener("click", () => openCardModal("create"));
ui.editCardBtn.addEventListener("click", () => openCardModal("edit"));
ui.deleteCardBtn.addEventListener("click", deleteActiveCard);

ui.flipCardBtn.addEventListener("click", flipCard);
ui.prevCardBtn.addEventListener("click", showPreviousCard);
ui.nextCardBtn.addEventListener("click", showNextCard);
ui.shuffleBtn.addEventListener("click", shuffleCards);

ui.deckList.addEventListener("click", (event) => {
	const target = event.target;
	if (!(target instanceof HTMLButtonElement)) {
		return;
	}
	const deckId = target.dataset.deckId;
	if (!deckId) {
		return;
	}
	state.activeDeckId = deckId;
	state.ui.activeCardIndex = 0;
	persistState();
	enterStudyMode(deckId);
	render();
});

ui.cardList.addEventListener("click", (event) => {
	const target = event.target;
	if (!(target instanceof HTMLButtonElement)) {
		return;
	}
	const cardId = target.dataset.cardId;
	if (!cardId) {
		return;
	}

	const pos = runtime.studyCardOrderIds.indexOf(cardId);
	if (pos < 0) {
		return;
	}
	state.ui.activeCardIndex = pos;
	resetFlipState();
	renderCard();
});

ui.searchInput.addEventListener("input", (event) => debounceSearchInput(event.target.value));

ui.deckForm.addEventListener("submit", handleDeckSubmit);
ui.cardForm.addEventListener("submit", handleCardSubmit);

ui.deckNameInput.addEventListener("input", () => clearFieldError(ui.deckNameInput, ui.deckNameError));
ui.cardFrontInput.addEventListener("input", () => clearFieldError(ui.cardFrontInput, ui.cardFrontError));
ui.cardBackInput.addEventListener("input", () => clearFieldError(ui.cardBackInput, ui.cardBackError));

ui.deckCancelBtn.addEventListener("click", closeModal);
ui.cardCancelBtn.addEventListener("click", closeModal);

ui.deckModal.addEventListener("keydown", handleModalKeydown);
ui.cardModal.addEventListener("keydown", handleModalKeydown);

ui.deckModal.addEventListener("click", (event) => {
	const target = event.target;
	if (target instanceof HTMLElement && target.dataset.closeModal === "true") {
		closeModal();
	}
});

ui.cardModal.addEventListener("click", (event) => {
	const target = event.target;
	if (target instanceof HTMLElement && target.dataset.closeModal === "true") {
		closeModal();
	}
});

render();
if (state.activeDeckId) {
	enterStudyMode(state.activeDeckId);
} else {
	exitStudyMode();
}
