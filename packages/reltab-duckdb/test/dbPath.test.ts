import * as path from "path";
import {
  WIN_MAX_PATH,
  duckDbPath,
  duckDbPathLiteral,
  isRemotePath,
  winLongPath,
} from "../src/dbPath";

const isWin = process.platform === "win32";

/** A local path of exactly `len` characters, ending in .parquet */
const mkPath = (len: number): string => {
  const head = isWin ? "C:\\t\\" : "/t/";
  const tail = "\\a.parquet".replace("\\", isWin ? "\\" : "/");
  const pad = len - head.length - tail.length;
  return head + "x".repeat(pad) + tail;
};

describe("isRemotePath", () => {
  it("recognizes network schemes", () => {
    expect(isRemotePath("s3://bucket/a.parquet")).toBe(true);
    expect(isRemotePath("https://example.com/a.parquet")).toBe(true);
  });
  it("rejects local paths, including drive letters", () => {
    expect(isRemotePath("C:\\data\\a.parquet")).toBe(false);
    expect(isRemotePath("/data/a.parquet")).toBe(false);
    expect(isRemotePath("a.parquet")).toBe(false);
  });
});

describe("winLongPath", () => {
  it("prefixes a drive-letter path", () => {
    expect(winLongPath("C:\\data\\a.parquet")).toBe("\\\\?\\C:\\data\\a.parquet");
  });
  it("uses the UNC form for a network share", () => {
    expect(winLongPath("\\\\srv\\share\\a.parquet")).toBe(
      "\\\\?\\UNC\\srv\\share\\a.parquet"
    );
  });
  it("normalizes forward slashes, which the prefix disables", () => {
    expect(winLongPath("C:/data/sub/a.parquet")).toBe(
      "\\\\?\\C:\\data\\sub\\a.parquet"
    );
  });
  it("is idempotent", () => {
    const p = "\\\\?\\C:\\data\\a.parquet";
    expect(winLongPath(p)).toBe(p);
  });
});

describe("duckDbPath", () => {
  it("leaves paths within MAX_PATH alone", () => {
    const p = mkPath(WIN_MAX_PATH);
    expect(p.length).toBe(WIN_MAX_PATH);
    expect(duckDbPath(p)).toBe(p);
  });

  it("leaves remote paths alone however long", () => {
    const p = "s3://bucket/" + "x".repeat(400) + "/a.parquet";
    expect(duckDbPath(p)).toBe(p);
  });

  if (isWin) {
    it("prefixes a path past MAX_PATH", () => {
      const p = mkPath(WIN_MAX_PATH + 1);
      expect(duckDbPath(p)).toBe("\\\\?\\" + p);
    });

    it("prefixes the Spark-style deep parquet paths that motivated this", () => {
      const p = path.win32.join(
        "D:\\Dropbox\\Dropbox\\immigrants-restaurants\\build\\input\\linkedin",
        "restaurant_linkedin_datasets",
        "restaurant_linkedin_exact_plus_fuzzy_owner_backbone_refresh_20260715_021137",
        "crosswalks\\exact_plus_fuzzy",
        "part-00000-b91d1340-bef4-48a9-a528-bd0f43dd209e-c000.snappy.parquet"
      );
      expect(p.length).toBeGreaterThan(WIN_MAX_PATH);
      expect(duckDbPath(p).startsWith("\\\\?\\")).toBe(true);
    });
  } else {
    it("is a no-op off Windows", () => {
      expect(duckDbPath(mkPath(400))).toBe(mkPath(400));
    });
  }
});

describe("duckDbPathLiteral", () => {
  it("quotes the path", () => {
    expect(duckDbPathLiteral("/data/a.parquet")).toBe("'/data/a.parquet'");
  });
  it("escapes embedded single quotes", () => {
    expect(duckDbPathLiteral("/data/o'brien.parquet")).toBe(
      "'/data/o''brien.parquet'"
    );
  });
});
