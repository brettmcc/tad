import { matchDataFileExtension } from "../src/defs";

describe("matchDataFileExtension", () => {
  it("matches plain extensions", () => {
    expect(matchDataFileExtension("movies.csv")).toBe("csv");
    expect(matchDataFileExtension("movies.tsv")).toBe("tsv");
    expect(matchDataFileExtension("movies.parquet")).toBe("parquet");
  });

  it("prefers the longest match for compound extensions", () => {
    expect(matchDataFileExtension("movies.csv.gz")).toBe("csv.gz");
    expect(matchDataFileExtension("movies.tsv.gz")).toBe("tsv.gz");
  });

  it("matches Spark part files, whose names carry a codec segment", () => {
    expect(
      matchDataFileExtension(
        "part-00000-b91d1340-bef4-48a9-a528-bd0f43dd209e-c000.snappy.parquet"
      )
    ).toBe("parquet");
    expect(matchDataFileExtension("part-00000.gz.parquet")).toBe("parquet");
  });

  it("is case insensitive", () => {
    expect(matchDataFileExtension("MOVIES.CSV")).toBe("csv");
    expect(matchDataFileExtension("Part-0.Snappy.Parquet")).toBe("parquet");
  });

  it("rejects non-data files", () => {
    expect(matchDataFileExtension("_SUCCESS")).toBeNull();
    expect(matchDataFileExtension("README.md")).toBeNull();
    expect(matchDataFileExtension("manifest.json")).toBeNull();
    expect(matchDataFileExtension("archive.tar")).toBeNull();
    // Spark checksum sidecars sit alongside the parts
    expect(matchDataFileExtension(".part-00000.snappy.parquet.crc")).toBeNull();
  });

  it("rejects a bare extension with no basename", () => {
    expect(matchDataFileExtension(".parquet")).toBeNull();
    expect(matchDataFileExtension("parquet")).toBeNull();
  });
});
