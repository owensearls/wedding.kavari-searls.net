-- Initial event placeholders. Edit names/dates/details via the admin UI.
INSERT INTO event (id, name, slug, starts_at, location_name, address, requires_meal_choice, sort_order)
VALUES
  ('evt_ceremony', 'Ceremony', 'ceremony', '2026-09-19T16:00:00-04:00', 'Hartland, Vermont', NULL, 0, 10),
  ('evt_reception', 'Reception', 'reception', '2026-09-19T18:00:00-04:00', 'Hartland, Vermont', NULL, 1, 20);
