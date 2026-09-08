-- Supersedes init_messier.sql now that the catalog spans Messier, NGC, and
-- Caldwell objects. Coordinates/magnitudes are well-known published J2000
-- approximations, same precision level as the original Messier seed data —
-- fine for a local hobbyist catalog, not survey-grade astrometry.
CREATE TABLE IF NOT EXISTS deep_sky_targets (
    id TEXT PRIMARY KEY,
    catalog TEXT NOT NULL,
    common_name TEXT,
    type TEXT,
    constellation TEXT,
    ra_decimal REAL NOT NULL,
    dec_decimal REAL NOT NULL,
    magnitude REAL,
    description TEXT
);

INSERT OR REPLACE INTO deep_sky_targets VALUES
-- Messier (Phase 1)
('M31', 'Messier', 'Andromeda Galaxy', 'Spiral Galaxy', 'Andromeda', 0.7123, 41.2687, 3.44, 'Nearest major galaxy to the Milky Way.'),
('M42', 'Messier', 'Orion Nebula', 'Emission Nebula', 'Orion', 5.5883, -5.3911, 4.0, 'Bright star-forming region in the constellation Orion.'),
('M13', 'Messier', 'Great Globular Cluster in Hercules', 'Globular Cluster', 'Hercules', 16.6881, 36.4600, 5.8, 'Spherical collection of around 300,000 stars.'),
('M45', 'Messier', 'Pleiades', 'Open Cluster', 'Taurus', 3.7833, 24.1167, 1.6, 'Prominent open star cluster containing luminous B-type stars.'),
-- NGC
('NGC7000', 'NGC', 'North America Nebula', 'Emission Nebula', 'Cygnus', 20.9833, 44.5167, 4.0, 'Vast emission nebula whose shape resembles the continent of North America.'),
('NGC253', 'NGC', 'Sculptor Galaxy', 'Spiral Galaxy', 'Sculptor', 0.7925, -25.2883, 7.1, 'One of the brightest galaxies visible from Earth, a starburst spiral.'),
('NGC4565', 'NGC', 'Needle Galaxy', 'Spiral Galaxy', 'Coma Berenices', 12.6053, 25.9878, 9.6, 'Nearly edge-on spiral galaxy, a classic example of a flat, thin disk.'),
('NGC2237', 'NGC', 'Rosette Nebula', 'Emission Nebula', 'Monoceros', 6.5333, 4.9500, 9.0, 'Large circular emission nebula surrounding a cluster of young hot stars.'),
('NGC6543', 'NGC', 'Cat''s Eye Nebula', 'Planetary Nebula', 'Draco', 17.8983, 66.6331, 8.1, 'Complex planetary nebula with intricate structure from a dying Sun-like star.'),
('NGC6946', 'NGC', 'Fireworks Galaxy', 'Spiral Galaxy', 'Cepheus', 20.5817, 60.1536, 9.6, 'Face-on spiral galaxy known for its unusually frequent supernovae.'),
('NGC7635', 'NGC', 'Bubble Nebula', 'Emission Nebula', 'Cassiopeia', 23.3400, 61.2000, 10.0, 'Emission nebula shaped by the stellar wind of a hot young star.'),
('NGC891', 'NGC', 'Silver Sliver Galaxy', 'Spiral Galaxy', 'Andromeda', 2.3742, 42.3492, 9.9, 'Edge-on spiral galaxy with a prominent dark dust lane.'),
-- Caldwell
('C14', 'Caldwell', 'Double Cluster', 'Open Cluster', 'Perseus', 2.3200, 57.1333, 3.7, 'Pair of open star clusters, NGC 869 and NGC 884, visible to the naked eye.'),
('C80', 'Caldwell', 'Omega Centauri', 'Globular Cluster', 'Centaurus', 13.4467, -47.4792, 3.9, 'Largest and brightest globular cluster in the Milky Way.'),
('C55', 'Caldwell', 'Saturn Nebula', 'Planetary Nebula', 'Aquarius', 21.0700, -11.3689, 8.0, 'Planetary nebula named for its resemblance to the planet Saturn through a telescope.'),
('C94', 'Caldwell', 'Jewel Box', 'Open Cluster', 'Crux', 12.8858, -60.3617, 4.2, 'Colorful open cluster of young, hot stars near the Southern Cross.'),
('C63', 'Caldwell', 'Helix Nebula', 'Planetary Nebula', 'Aquarius', 22.4942, -20.8372, 7.6, 'One of the closest and brightest planetary nebulae, nicknamed the Eye of God.'),
('C92', 'Caldwell', 'Carina Nebula', 'Emission Nebula', 'Carina', 10.7500, -59.8667, 3.0, 'Enormous star-forming region containing the massive star Eta Carinae.'),
('C41', 'Caldwell', 'Hyades', 'Open Cluster', 'Taurus', 4.4667, 15.8700, 0.5, 'Nearest open star cluster to Earth, forming the head of Taurus the Bull.'),
('C9', 'Caldwell', 'Cave Nebula', 'Emission Nebula', 'Cepheus', 22.9833, 62.6167, 7.7, 'Faint emission and reflection nebula complex in Cepheus.');
