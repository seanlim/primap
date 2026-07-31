ALTER TYPE species_type ADD VALUE 'OTHER';
ALTER TABLE sightings ADD COLUMN species_other text;;
