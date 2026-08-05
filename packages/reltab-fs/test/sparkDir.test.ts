/**
 * Browsing a Spark output directory: the parts are named
 * `part-NNNNN-<uuid>-cNNN.snappy.parquet` and sit alongside `_SUCCESS`
 * and hidden `.crc` checksum sidecars.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { DbDataSource, getConnection } from "reltab";
import "../src/reltab-fs";

const PART_NAMES = [
  "part-00000-b91d1340-bef4-48a9-a528-bd0f43dd209e-c000.snappy.parquet",
  "part-00001-b91d1340-bef4-48a9-a528-bd0f43dd209e-c000.snappy.parquet",
];

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reltab-fs-sparkdir-"));
  for (const name of PART_NAMES) {
    fs.writeFileSync(path.join(tmpDir, name), "");
    fs.writeFileSync(path.join(tmpDir, "." + name + ".crc"), "");
  }
  fs.writeFileSync(path.join(tmpDir, "_SUCCESS"), "");
  fs.writeFileSync(path.join(tmpDir, "._SUCCESS.crc"), "");
  fs.writeFileSync(path.join(tmpDir, "README.md"), "");
  fs.writeFileSync(path.join(tmpDir, "plain.csv"), "a,b\n1,2\n");
  fs.mkdirSync(path.join(tmpDir, "nested"));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("lists .snappy.parquet parts and skips Spark sidecars", async () => {
  const dsConn = (await getConnection({
    providerName: "localfs",
    resourceId: tmpDir,
  })) as DbDataSource;
  const children = await dsConn.getChildren({
    sourceId: dsConn.sourceId,
    path: [],
  });
  const names = children.map((c) => c.displayName).sort();
  expect(names).toEqual([...PART_NAMES, "nested", "plain.csv"].sort());
});
