function stringifyError(value) {
  if (value instanceof Error) return value.message;
  return String(value);
}

function redact(value) {
  return stringifyError(value)
    .replace(/postgres(?:ql)?:\/\/[^\s'"`]+/gi, "postgresql://***")
    .replace(
      /\b(database_url(?:_unpooled)?|postgres_url_non_pooling|connection_string)\s*=\s*[^\s'"`]+/gi,
      "$1=***"
    )
    .replace(
      /\b(password|pass|pwd|token|secret)\s*([=:])\s*[^\s&,;'"`]+/gi,
      "$1$2***"
    );
}

function formatDatabaseError(error) {
  if (!error || typeof error !== "object") {
    return redact(error || "Unknown database error");
  }

  const databaseError = error;
  const parts = [];
  if (typeof databaseError.code === "string" && databaseError.code) {
    parts.push(`code ${databaseError.code}`);
  }
  for (const key of ["message", "detail", "hint"]) {
    if (typeof databaseError[key] === "string" && databaseError[key]) {
      parts.push(databaseError[key]);
    }
  }

  return redact(parts.length > 0 ? parts.join(": ") : "Unknown database error");
}


module.exports = { formatDatabaseError, redact };
