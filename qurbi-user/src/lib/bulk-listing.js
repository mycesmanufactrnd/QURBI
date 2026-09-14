export function getBreedGenderBreakdown(listing) {
  return (listing?.breedBreakdown || []).map((entry, index) => {
    if (typeof entry === "string") {
      return {
        key: `${entry}-${index}`,
        species: "",
        breed: entry,
        maleCount: null,
        femaleCount: null,
        total: null,
        hasGenderSplit: false,
      };
    }

    const hasGenderSplit = entry.maleCount != null && entry.femaleCount != null;
    const maleCount = hasGenderSplit ? Number(entry.maleCount || 0) : null;
    const femaleCount = hasGenderSplit ? Number(entry.femaleCount || 0) : null;

    return {
      key: `${entry.species || "species"}-${entry.breed || entry.name || "breed"}-${index}`,
      species: entry.species || "",
      breed: entry.breed || entry.name || "Breed",
      maleCount,
      femaleCount,
      total: hasGenderSplit
        ? maleCount + femaleCount
        : entry.count != null
          ? Number(entry.count || 0)
          : null,
      hasGenderSplit,
    };
  });
}

export function compactBreedGenderLabel(row) {
  if (!row.hasGenderSplit) return row.total == null ? row.breed : `${row.breed}: ${row.total} total`;
  return `${row.breed}: ${row.maleCount} male / ${row.femaleCount} female`;
}
