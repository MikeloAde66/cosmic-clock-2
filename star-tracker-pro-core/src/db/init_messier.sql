CREATE TABLE IF NOT EXISTS messier_targets (
    id TEXT PRIMARY KEY,
    common_name TEXT,
    type TEXT,
    constellation TEXT,
    ra_decimal REAL NOT NULL,
    dec_decimal REAL NOT NULL,
    magnitude REAL,
    description TEXT
);

INSERT OR REPLACE INTO messier_targets VALUES
('M31', 'Andromeda Galaxy', 'Spiral Galaxy', 'Andromeda', 0.7123, 41.2687, 3.44, 'Nearest major galaxy to the Milky Way.'),
('M42', 'Orion Nebula', 'Emission Nebula', 'Orion', 5.5883, -5.3911, 4.0, 'Bright star-forming region in the constellation Orion.'),
('M13', 'Great Globular Cluster in Hercules', 'Globular Cluster', 'Hercules', 16.6881, 36.4600, 5.8, 'Spherical collection of around 300,000 stars.'),
('M45', 'Pleiades', 'Open Cluster', 'Taurus', 3.7833, 24.1167, 1.6, 'Prominent open star cluster containing luminous B-type stars.');
