# Flashcards App

## Reflection

- AI saved me time by quickly scaffolding the full app shell and then iterating fast on each lab part (Deck CRUD, Card CRUD, Study Mode, Search, Persistence) without me hand-writing every boilerplate event handler and modal pattern from scratch.
- One AI bug I identified was that `Prev` and `Next` initially did not work correctly because card navigation was not backed by a real per-deck card collection. I fixed it by introducing deck-specific card arrays, active card indexing, and then resetting flip state on every navigation/deck change.
- A snippet I refactored for clarity was state management: I moved from mixed deck/card-in-deck objects to a clearer app model (`decks`, `cardsByDeckId`, `activeDeckId`, `ui`) and split logic into focused helpers like `getActiveDeck()`, `getCardsForDeck()`, `enterStudyMode()`, and `renderCard()`.
- One accessibility improvement I added was accessible modal behavior with keyboard support (focus trap, Escape to close, return focus to opener), plus inline field error messaging (`aria-invalid`, `role="alert"`) and live status announcements for create/update/delete actions.
- Prompt changes that improved AI output were making requests explicit and constraint-based, such as: “use in-memory array first,” “add focus trap + ESC + return focus,” “debounced search 300ms without mutating source data,” and “avoid listener leaks/off-by-one errors in study navigation.”

## Notes

This project includes:

- `index.html`
- `styles.css`
- `storage.js`
- `app.js`
