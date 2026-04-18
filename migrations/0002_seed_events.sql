-- Seed the two default wedding events. Edit via the admin UI.
INSERT INTO event (id, name, slug, starts_at, location_name, requires_meal_choice, sort_order)
VALUES
  ('evt_ceremony', 'Ceremony', 'ceremony', '2026-09-19T16:00:00-04:00', 'Hartland, Vermont', 0, 10),
  ('evt_reception', 'Reception', 'reception', '2026-09-19T18:00:00-04:00', 'Hartland, Vermont', 1, 20);
