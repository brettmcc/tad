/**
 * Path munging for filenames handed to DuckDB.
 */

import * as path from "path";

/**
 * Longest Windows path DuckDB's file layer can open unaided: MAX_PATH
 * (260) minus the terminating NUL. Measured against @duckdb/node-api on
 * Windows 11 -- 259 chars opens, 260 fails.
 */
export const WIN_MAX_PATH = 259;

const remotePathRE = /^[a-z][a-z0-9+.-]*:\/\//i;

/** true for s3://, https://, ... -- anything DuckDB fetches over the network */
export const isRemotePath = (fsPath: string): boolean =>
  remotePathRE.test(fsPath);

/**
 * Rewrite `fsPath` in Windows extended-length form (`\\?\C:\...`, or
 * `\\?\UNC\server\share\...` for a UNC path). The prefix turns off all
 * path normalization in the Win32 API, so the path must already be
 * absolute and backslash-separated.
 */
export const winLongPath = (fsPath: string): string => {
  if (fsPath.startsWith("\\\\?\\")) {
    return fsPath;
  }
  const resolved = path.win32.resolve(fsPath).replace(/\//g, "\\");
  return resolved.startsWith("\\\\")
    ? "\\\\?\\UNC\\" + resolved.slice(2)
    : "\\\\?\\" + resolved;
};

/**
 * DuckDB's Windows file layer is not long-path aware: a path at or past
 * MAX_PATH fails with "No files found that match the pattern", even with
 * the LongPathsEnabled registry setting on (that only applies to
 * processes whose manifest opts in). Deeply nested datasets -- e.g. the
 * `part-00000-<uuid>-c000.snappy.parquet` files Spark emits -- hit this
 * routinely. The extended-length prefix bypasses the limit.
 *
 * Applied only where it's needed: the prefix also disables the "." and
 * ".." handling that shorter paths may rely on.
 */
export const duckDbPath = (fsPath: string): string => {
  if (process.platform !== "win32" || isRemotePath(fsPath)) {
    return fsPath;
  }
  return fsPath.length > WIN_MAX_PATH ? winLongPath(fsPath) : fsPath;
};

/** Quote `fsPath` as a SQL string literal for use in a DuckDB query. */
export const duckDbPathLiteral = (fsPath: string): string =>
  "'" + duckDbPath(fsPath).replace(/'/g, "''") + "'";
