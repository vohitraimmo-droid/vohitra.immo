
-- Index composite principal pour la liste publique
CREATE INDEX IF NOT EXISTS idx_properties_status_premium_created
  ON public.properties (status, is_premium DESC, created_at DESC);

-- Index par ville (recherche/filtre)
CREATE INDEX IF NOT EXISTS idx_properties_city_lower
  ON public.properties (lower(city));

-- Index pour les filtres type
CREATE INDEX IF NOT EXISTS idx_properties_property_type
  ON public.properties (property_type);

CREATE INDEX IF NOT EXISTS idx_properties_listing_type
  ON public.properties (listing_type);

-- Index pour le propriétaire (dashboard owner)
CREATE INDEX IF NOT EXISTS idx_properties_owner_status
  ON public.properties (owner_id, status, created_at DESC);

-- Photos: lookup par property
CREATE INDEX IF NOT EXISTS idx_property_photos_property
  ON public.property_photos (property_id, display_order);

-- Favorites: lookup par user
CREATE INDEX IF NOT EXISTS idx_favorites_user
  ON public.favorites (user_id, created_at DESC);

-- Contact unlocks lookup
CREATE INDEX IF NOT EXISTS idx_contact_unlocks_user_property
  ON public.contact_unlocks (user_id, property_id);

-- Visit bookings
CREATE INDEX IF NOT EXISTS idx_visit_bookings_tenant
  ON public.visit_bookings (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_visit_bookings_property
  ON public.visit_bookings (property_id, created_at DESC);

-- Visit slots
CREATE INDEX IF NOT EXISTS idx_visit_slots_property_slot
  ON public.visit_slots (property_id, slot_at);
