// Example expansion pack, proving pack_loader.js's mechanism end-to-end:
// adds one target the base catalog doesn't have, plus extra lore lines for
// two existing Messier targets.
export default {
  id: 'starter-lore',
  targets: [
    {
      id: 'NGC2264',
      catalog: 'NGC',
      common_name: 'Christmas Tree Cluster',
      type: 'Open Cluster',
      constellation: 'Monoceros',
      ra_decimal: 6.6667,
      dec_decimal: 9.8833,
      magnitude: 3.9,
      description: 'Open star cluster whose triangular shape resembles a Christmas tree, embedded in a faint nebula.',
    },
  ],
  lore: {
    M42: [
      'In Greek myth, this glow marks the tip of the sword hanging from Orion\'s belt.',
    ],
    M31: [
      'The light arriving right now left Andromeda about two and a half million years ago.',
    ],
  },
};
