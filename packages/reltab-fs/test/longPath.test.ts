/**
 * Integration tests for opening files whose paths exceed Windows'
 * MAX_PATH -- routine for a Spark output tree, which nests deeply and
 * names parts `part-NNNNN-<uuid>-cNNN.snappy.parquet`.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { DataSourcePath, DbDataSource, getConnection, Row } from "reltab";
import * as reltabDuckDB from "reltab-duckdb";
import "../src/reltab-fs";

const PART_NAME =
  "part-00000-b91d1340-bef4-48a9-a528-bd0f43dd209e-c000.snappy.parquet";

let tmpDir: string;
let deepDir: string;
let deepParquetPath: string;

/** forward-slash form of a path for use inside SQL string literals */
const sqlPath = (p: string): string => p.replace(/\\/g, "/");

/**
 * A directory under `tmpDir` deep enough that `<dir>/<PART_NAME>` runs
 * past MAX_PATH. Built from nested segments rather than one long name so
 * we stay under the 255-char per-component limit.
 */
function mkDeepDir(base: string, targetPathLen: number): string {
  let dir = base;
  const want = targetPathLen - (PART_NAME.length + 1);
  while (dir.length < want) {
    const remaining = want - dir.length - 1;
    dir = path.join(dir, "d".repeat(Math.max(1, Math.min(60, remaining))));
  }
  return dir;
}

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reltab-fs-longpath-"));
  // comfortably past MAX_PATH (260) so the test is not itself borderline
  deepDir = mkDeepDir(tmpDir, 300);
  fs.mkdirSync(deepDir, { recursive: true });
  deepParquetPath = path.join(deepDir, PART_NAME);

  const db = await reltabDuckDB.DuckDBDatabase.open(":memory:", {
    readOnly: false,
  });
  const conn = await db.connect();
  try {
    // DuckDB can't write to the long path either, so write short and move
    const stagePath = path.join(tmpDir, "stage.parquet");
    await reltabDuckDB.execStatements(
      conn,
      `COPY (SELECT range AS x, range * 2 AS y FROM range(100))
       TO '${sqlPath(stagePath)}' (FORMAT PARQUET)`
    );
    fs.copyFileSync(stagePath, deepParquetPath);
    fs.rmSync(stagePath);
  } finally {
    reltabDuckDB.closeConnection(conn);
    db.close();
  }
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function openFile(filePath: string): Promise<{
  dsConn: DbDataSource;
  dsPath: DataSourcePath;
  tableName: string;
}> {
  const dsConn = (await getConnection({
    providerName: "localfs",
    resourceId: filePath,
  })) as DbDataSource;
  const dsPath: DataSourcePath = { sourceId: dsConn.sourceId, path: ["."] };
  const tableName = await dsConn.getTableName(dsPath);
  return { dsConn, dsPath, tableName };
}

test("fixture path really does exceed MAX_PATH", () => {
  expect(deepParquetPath.length).toBeGreaterThan(260);
});

test("opens a parquet file whose path exceeds MAX_PATH", async () => {
  const { dsConn, dsPath, tableName } = await openFile(deepParquetPath);

  const rows: Row[] = await dsConn.db.runSqlQuery(
    `SELECT count(*) AS n FROM ${tableName}`
  );
  expect(Number(rows[0].n)).toBe(100);

  // the materialize round-trip re-issues parquet_scan on the same path
  const est = await dsConn.getMaterializeEstimate(dsPath);
  expect(est.estimatedBytes).toBeGreaterThan(0);

  await dsConn.setMaterialized(dsPath, true);
  await dsConn.setMaterialized(dsPath, false);
  const afterRows: Row[] = await dsConn.db.runSqlQuery(
    `SELECT count(*) AS n FROM ${tableName}`
  );
  expect(Number(afterRows[0].n)).toBe(100);
});
