const errors = require("./errors.cjs") as {
  formatDatabaseError: (error: unknown) => string;
};
export const formatDatabaseError = errors.formatDatabaseError;
